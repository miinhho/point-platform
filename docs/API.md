# API 계약

Mock 서버와 실서버(Spring Boot + Kotlin + MySQL)가 **같은 계약**을 구현한다. 클라이언트는 `PointApi` 인터페이스에만 의존하고, 교체는 구현체를 바꾸는 것으로 끝난다.

## 설계 결정

### 멱등성은 처음부터 넣는다

이체는 되돌릴 수 없다(헌법 23조). 그러므로 네트워크 재시도로 인한 이중 이체는 치명적이다. 헌법 12조는 "실패 시 재시도 경로를 제시하라"고 요구하는데, **재시도를 안전하게 만드는 것이 멱등성**이다.

- 클라이언트가 `idempotencyKey`(UUID)를 생성해서 보낸다
- 같은 키로 재요청하면 서버는 **새 이체를 만들지 않고 기존 것을 반환**한다
- 키는 사용자가 금액 입력을 마치고 확정 화면에 진입할 때 생성한다. 재시도 버튼은 같은 키를 재사용한다
- Mock에서도 동일하게 동작하므로, 실서버 교체 전에 검증된다

### 취소 창은 서버 상태로 표현한다

헌법 9조의 3초 취소 창을 클라이언트 타이머만으로 구현하면, 헌법 11조("서버가 확정하기 전에 완료라고 말하지 않는다")와 충돌한다. 3초 동안 앱이 무슨 상태인지 설명할 수 없기 때문이다.

그래서 서버가 `pending` 상태로 접수하고, `cancelableUntil`까지 취소를 받는다.

```
                  ┌─────────────► cancelled   (cancelableUntil 이전에만)
                  │
 (요청) ──► pending ──────────────► confirmed  (모든 단계 완료. 되돌릴 수 없음)
                  │
                  └─────────────► failed
```

**`pending`은 두 구간으로 나뉜다.**

| 구간 | 시각 | 무슨 일이 일어나는가 | 취소 |
|---|---|---|---|
| 취소 창 | `createdAt` ~ `cancelableUntil` | **아무 처리도 하지 않는다** | 가능 |
| 처리 중 | `cancelableUntil` ~ `confirmedAt` | 단계가 실제로 진행된다 | 불가 |

취소 창 동안 이미 출금해 두면, "취소 가능"은 거짓말이 된다. 그래서 창이 끝난 뒤에 처리를 시작한다. `cancelableUntil`을 서버가 정하므로 클라이언트 시계를 신뢰하지 않는다.

이 구분은 화면 문구에도 그대로 나타나야 한다. 취소 창 동안은 "보내는 중"이 아니라 "3초 후 보냅니다"다.

### 발행은 이체와 같은 상태 기계를 쓴다

헌법 24조에 따라 발행은 이체보다 위험하다. 그러나 상태 기계는 동일하게 두고, **취소 창의 길이만 다르게** 한다. 상태 모델을 두 벌 만들면 어느 쪽 규칙이 적용되는지 흐려진다.

| | 취소 창 |
|---|---|
| 이체 | 3초 |
| 발행 | 8초 |

## 타입

`web/src/domain/types.ts` 가 원본이다. 이 문서는 요약이다.

```ts
type Points = number          // 정수. 최소 단위 1P. 소수점 없음
type UserId = string
type TransferStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed'

interface User {
  id: UserId
  name: string        // 사람이 검증할 수 있는 것 (헌법 6조)
  handle: string      // @minho — 계좌번호 역할. 작게 표시한다
  role: 'member' | 'issuer'
}

interface Ledger {
  totalIssued: Points   // 총 발행량
  issueCap: Points      // 발행 상한 (헌법 22조)
}

interface Transfer {
  id: string
  idempotencyKey: string
  kind: 'transfer' | 'issue'
  fromId: UserId | null      // issue는 null (무에서 발행)
  toId: UserId
  amount: Points
  memo?: string
  status: TransferStatus
  completedSteps: ProgressStep[]  // 서버가 실제로 끝낸 단계만
  createdAt: string               // ISO 8601
  cancelableUntil: string         // 취소 창의 끝. 이후 처리 시작
  confirmedAt?: string            // 모든 단계 완료 시각
  failure?: { code: FailureCode; message: string }
}
```

## 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/me` | 현재 사용자 + 잔액 |
| `GET` | `/users` | 최근 이체 대상 + 검색 (`?q=`) |
| `GET` | `/ledger` | 총 발행량, 발행 상한 (헌법 22조) |
| `POST` | `/transfers` | 이체 요청. `Idempotency-Key` 필수 |
| `POST` | `/transfers/:id/cancel` | 취소. `cancelableUntil` 이전에만 |
| `GET` | `/transfers/:id` | 단건 조회 (확정 대기 중 폴링) |
| `GET` | `/transfers` | 내역 (`?limit=&cursor=`) |
| `POST` | `/issues` | 발행. `issuer` 역할만. `Idempotency-Key` 필수 |

## 실패 코드

클라이언트는 코드로 분기하고, `message`를 그대로 화면에 뿌리지 않는다. 헌법 12조에 따라 화면 문구는 "무엇이 실패했는지 / 돈이 어디 있는지 / 지금 뭘 할 수 있는지"를 담아야 하고, 그건 서버 메시지로 대체되지 않는다.

| 코드 | 의미 | 재시도 가능 |
|---|---|---|
| `INSUFFICIENT_BALANCE` | 잔액 부족 | 아니오 (금액 수정 필요) |
| `CAP_EXCEEDED` | 발행 상한 초과 | 아니오 |
| `NOT_CANCELLABLE` | 취소 창이 지났다 | 아니오 |
| `RECIPIENT_NOT_FOUND` | 대상 없음 | 아니오 |
| `NETWORK` | 요청이 서버에 닿지 못함 | **예** (같은 키로) |
| `SERVER` | 서버 오류 | **예** (같은 키로) |

`NETWORK`와 `SERVER`는 **이체가 성립했는지 클라이언트가 알 수 없는 상태**다. 헌법 12조가 요구하는 "돈이 어디 있는지"를 답할 수 없으므로, 이 경우 화면은 추측하지 않고 "확인 중"으로 두고 `GET /transfers/:id`로 실제 상태를 조회한다. 멱등성 키가 있기 때문에 이 조회와 재시도가 안전하다.

## Mock 시뮬레이션

Mock은 동시성 충돌을 만들지 않는다(요청은 직렬 처리). 대신 헌법 10~12조를 검증하기 위해 아래를 주입할 수 있다.

```ts
interface SimConfig {
  latencyMs: number            // 기본 700
  jitterMs: number             // 기본 300
  failureRate: number          // 0.0 ~ 1.0. 기본 0
  forceFailure: FailureCode | null
  stepDelays: number[]         // 진행 단계별 지연 (헌법 10조)
}
```

`stepDelays`는 헌법 10조("스피너를 쓰지 않는다. 진행은 실제 단계로 보여준다")를 위한 것이다. 이체는 네 단계로 진행한다.

```
출금 → 이체 요청 → 상대 확인 → 입금 완료
```

실서버에서는 이 단계가 실제 처리 단계에 대응한다. Mock에서는 지연으로 흉내내되, **단계를 건너뛰거나 가짜로 먼저 완료 표시하지 않는다**(헌법 11조).

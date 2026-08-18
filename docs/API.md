# API 계약

계약은 **HTTP** 다. TypeScript 인터페이스가 아니다.

1차 구현에서는 `PointApi` 라는 TS 인터페이스를 계약이라 부르고 Mock 을 로컬 모듈로 두었다.
그러면 앱이 HTTP 를 한 번도 쓰지 않은 채 완성된다 — 멱등성 키가 헤더가 아니라 JS 객체
필드였고, "네트워크 실패"는 진짜 실패가 아니라 로컬에서 던진 예외였다. 실서버를 붙이는 날
클라이언트 계층을 처음부터 새로 써야 했을 것이다.

지금은 앱이 실제 `fetch` 를 하고 개발 중에는 **MSW** 가 그것을 가로챈다.
Spring Boot 가 오면 `src/mocks/` 만 지운다.

- 클라이언트: `src/api/http.ts`, `src/api/endpoints.ts`
- Mock 서버: `src/mocks/handlers.ts`, `src/mocks/ledger.ts`
- 시뮬레이션: `src/mocks/sim.ts`

기준 경로는 `/api` 다.

## 설계 결정

### 멱등성 키는 헤더다

```
POST /api/transfers
Idempotency-Key: 3a729bd1-8d12-4837-8082-97942afa0ed2
```

본문 필드로 보내면 서버가 본문을 파싱해야 키를 알 수 있고, 그러면 재시도 판정이 본문
스키마에 묶인다. 결제 API 들이 헤더를 쓰는 이유가 이것이다.

**키 없는 쓰기는 400 으로 거절한다.** 받아 주면 클라이언트가 키를 빼먹었을 때 조용히
이중 이체가 가능해지고, 그건 배포된 뒤에 발견된다.

같은 키로 다시 요청하면 새 이체를 만들지 않고 기존 것을 `200` 으로 돌려준다.

### 취소가 없다

`cancelableUntil`, `POST /transfers/:id/cancel`, `NOT_CANCELLABLE`, `cancelled` 상태가
모두 사라졌다. 이유는 `JOURNEY.md` 의 "버린 것" 에 있다 — 거의 쓰이지 않으면서 모든
이체에 인지 부하를 더하고, "몇 초 안에 결정" 자체가 스트레스다.

그래서 **쓰기는 동기·원자적**이다. 검증과 반영이 한 순간에 일어나고 응답은 확정된
이체이거나 오류다. 중간 상태가 없다는 것은 화면이 그릴 중간 상태도 없다는 뜻이다.

`Transfer` 에 `status` 필드가 없는 것도 같은 이유다. 저장된 이체는 언제나 확정된 것이다.
시스템이 만들어 낼 수 없는 값을 타입에 두면 화면은 그 상태를 그리게 되고, 그 화면은
영원히 검증되지 않는다.

**실패는 기록이 아니라 응답이다.** 실패한 요청은 내역에 남지 않는다.

### 포인트는 여럿이다

발행자마다 자기 포인트가 있고 사용자는 여러 종류를 동시에 가진다.

- 잔액은 `(pointTypeId, userId)` 단위다
- 이체는 **같은 종류끼리만** 일어난다. 요청에 `pointTypeId` 가 없으면 400
- 발행은 `PointType.issuerId` 와 요청자가 같을 때만 성공한다 (403 `NOT_ISSUER`)
- 최근 대상은 **포인트별로** 다르다

### 발행은 이체와 같은 모양이다

`POST /issues` 는 `POST /transfers` 와 같은 본문·같은 헤더를 받고 같은 `Transfer` 를
돌려준다. 다른 것은 `fromId` 가 `null` 이고(무에서 만든다) `totalIssued` 가 늘어난다는 점뿐이다.
클라이언트가 두 흐름을 하나의 상태 기계로 다룰 수 있는 이유다.

### 인증

모든 읽기·쓰기가 토큰을 통과한다. 화면마다 확인하면 한 곳이 빠지고, 빠진 곳이 남의
잔액을 보여준다.

```
Authorization: Bearer <token>
```

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/auth/login` | `{ handle, password }` → `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/refresh` | `{ refreshToken }` → `{ accessToken, refreshToken }` |
| `POST` | `/api/auth/logout` | `{ refreshToken }` → `204`. 그 사슬 전체 무효 |

**Access + Refresh 하이브리드다.** access 는 짧고(15분) refresh 는 길다(14일).
되돌릴 수 없는 송금을 다루므로 access 를 길게 두지 않는다.

**refresh 는 회전한다.** 갱신하면 옛 refresh 는 즉시 죽는다. 이미 회전된 것이 다시
오면 훔친 것일 수 있으므로 **그 사슬 전체를 무효화**한다 — 도둑과 주인 중 누가 먼저
왔는지 알 수 없으니 둘 다 끊는 것이 안전하다.

클라이언트는 `401` 을 받으면 **한 번 갱신하고 원요청을 다시 보낸다.** 멱등성 키가
헤더에 있어서 이 재시도가 안전하다 — 키를 처음부터 헤더로 둔 값이 여기서 난다.
갱신은 한 번에 하나만 돈다. 여럿이 동시에 갱신하면 회전 때문에 뒤엣것들이 재사용으로
탐지돼 세션이 통째로 죽는다.

토큰이 없거나 죽었으면 `401` + `{ "code": "UNAUTHENTICATED" }`,
자격증명이 틀리면 `401` + `{ "code": "BAD_CREDENTIALS" }` 다.
**어느 핸들이 존재하는지 알려주지 않는다** — 두 경우의 화면 문구가 같다.

**핸들 표기는 서버가 정규화한다.** 앞의 `@` 를 떼고 소문자로 맞춘 뒤 비교하므로
`@minho` · `minho` · `MINHO` 가 모두 같은 사람이다. 클라이언트는 입력을 그대로 보낸다 —
양쪽이 정규화하면 곧 한쪽이 달라진다. "@ 를 빠뜨렸어요" 라고 알려 주는 길은 만들지
않는다. 그것이 곧 존재하는 핸들을 알려 주는 길이다.

클라이언트는 토큰을 **메모리에만** 둔다. `localStorage` 에 두면 XSS 한 번에 새고,
이 앱은 되돌릴 수 없는 송금을 다룬다. 새로고침하면 다시 로그인하는 것이 그 대가다.

## 엔드포인트

| 메서드 | 경로 | 응답 | 설명 |
|---|---|---|---|
| `GET` | `/api/me` | `User` | 현재 사용자 |
| `GET` | `/api/wallet` | `Wallet` | 포인트별 잔액 전부 |
| `GET` | `/api/point-types` | `PointType[]` | 존재하는 포인트 종류 |
| `GET` | `/api/users?q=` | `User[]` | 검색. 질의 없으면 전체 |
| `GET` | `/api/recent?pointTypeId=&limit=` | `User[]` | 그 포인트로 최근에 보낸 사람 |
| `POST` | `/api/transfers` | `Transfer` `201` | 이체. `Idempotency-Key` 필수 |
| `POST` | `/api/issues` | `Transfer` `201` | 발행. 발행자만. **대상 없음** |
| `GET` | `/api/transfers/:id` | `Transfer` | 단건. **404 는 일어나지 않았다는 뜻** |
| `GET` | `/api/transfers/by-key?idempotencyKey=` | `Transfer \| null` | 결과를 모를 때의 확인 |
| `GET` | `/api/transfers?pointTypeId=&limit=` | `Transfer[]` | 내역, 최신순 |

이체 본문:

```json
{ "pointTypeId": "pt_on", "toId": "u_jisoo", "amount": 30000 }
```

발행 본문 — **`toId` 를 받지 않는다.** 발행은 자기 지갑으로만 들어간다
(`docs/JOURNEY.md` 여정 7). 대상이 실려 오면 `400` 이다. 조용히 무시하면 발행과
이체가 같은 흐름에서 섞이고, 발행자는 잘못 고른 것을 알 방법이 없다.

```json
{ "pointTypeId": "pt_gm", "amount": 100000 }
```

`GET /api/transfers/by-key` 는 없을 때 `404` 가 아니라 `null` 을 준다.
"안 일어났다" 는 오류가 아니라 정상적인 답이다. 응답을 받지 못한 클라이언트는
이체 id 를 모르므로 id 로는 물을 수 없고, 이것이 유일한 확인 수단이다.

`GET /api/wallet` 은 잔액이 0인 포인트도 **내가 발행자라면** 포함한다. 가졌던 것과
가진 적 없는 것은 다르고, 그 판단은 화면이 한다.

`PointType` 과 `Balance` 는 **요청자 기준으로** 온다. 규칙 판정을 클라이언트가 다시 하지
않게 서버가 결과를 실어 준다 — 같은 규칙이 두 곳에 있으면 곧 한쪽이 틀린다.

| 필드 | 뜻 |
|---|---|
| `PointType.canIssue` | 내가 이 포인트를 발행할 수 있는가 |
| `PointType.issuableHeadroom` | 지금 더 발행할 수 있는 양 |
| `Balance.sendable` | 지금 보낼 수 있는 양. 보류금이 생기면 `amount` 와 달라진다 |

`PointType` 에는 `issuerName` 도 함께 온다. 이름이 겹치는 포인트를 가르는 부제이고,
화면이 사용자 목록을 뒤져서 발행자 이름을 찾지 않게 서버가 실어 준다.

`GET /api/users?q=` 는 **결과에 동명이인을 무조건 함께 담는다.** 핸들로 검색해
한 명만 맞더라도 같은 이름을 가진 사람을 함께 준다 — 겹친다는 사실은 검색 결과의
성질이 아니라 원장의 성질이고, 클라이언트가 결과 안에서만 세면 `@jisu` 로 검색한
순간 동명이인 방어가 꺼진다.

## 실패

오류 응답 본문은 `{ "code": FailureCode, "message"?: string }` 이다.
클라이언트는 `code` 로 분기하고 `message` 를 화면에 그대로 뿌리지 않는다 — 화면 문구는
"무엇이 실패했는지 / 돈이 어디 있는지 / 지금 뭘 할 수 있는지"를 담아야 하고, 그건 서버
메시지로 대체되지 않는다.

| 코드 | 상태 | 의미 | 다음 행동 |
|---|---|---|---|
| `INSUFFICIENT_BALANCE` | 422 | 그 포인트의 잔액 부족 | 금액 수정 |
| `CAP_EXCEEDED` | 422 | 발행 상한 초과 | 금액 수정 |
| `NOT_ISSUER` | 403 | 그 포인트의 발행자가 아님 | 없음 (막다른 화면) |
| `RECIPIENT_NOT_FOUND` | 404 | 대상 없음 | 대상 다시 고르기 |
| `POINT_TYPE_NOT_FOUND` | 404 | 포인트 없음 | 없음 |
| `SERVER` | 5xx | 서버 오류 | **재시도** (같은 키) |
| `NETWORK` | — | 요청이 서버에 닿지 못함 | **확인하기** → 재시도 |

`NETWORK` 와 `SERVER` 만 **결과를 알 수 없는 실패**다. 서버가 요청을 처리했는지 알 수
없으므로 화면은 "실패했습니다"라고 단정하지 않는다. 멱등성 키가 있으므로 재시도가 안전하고,
`GET /api/transfers/:id` 로 실제 상태를 확인할 수도 있다.

`NETWORK` 는 응답이 아니다. MSW 는 `HttpResponse.error()` 로 **전송 자체를 실패**시킨다.
서버가 준 오류와 요청이 닿지 못한 것은 클라이언트에게 전혀 다른 상황이고, 그 차이를
흉내내면 "결과를 알 수 없다"를 검증할 수 없다.

## 시뮬레이션

`src/mocks/sim.ts`. 실패하지 않는 앱에서는 정직함을 시험할 수 없다.

```ts
interface SimConfig {
  latencyMs: number        // 기본 400
  jitterMs: number         // 기본 200
  failureRate: number      // 0.0 ~ 1.0. 기본 0
  forceFailure: FailureCode | null   // 다음 한 요청만. 쓰면 소모된다
  loseNextResponse: boolean          // 쓰기를 끝낸 뒤 응답을 버린다
}
```

`forceFailure: 'NETWORK'` 는 요청을 받기 **전에** 실패시키므로 서버는 언제나 아무것도
만들지 않은 상태다. 그것만으로는 멱등성을 시험할 수 없다 — 잔액이 0번에서 1번으로
가는 것을 보는 것뿐이다.

`loseNextResponse` 가 진짜 위험한 경우를 만든다. **서버는 이체를 만들었고 클라이언트는
응답을 받지 못한다.** 이때 같은 키로 재시도해서 잔액이 한 번만 움직이는지가 멱등성의
유일한 실제 검증이다.

## 실기기에서 볼 때

서비스 워커는 **보안 컨텍스트에서만** 등록된다. 폰에서 LAN IP(`http://172.30.x.x:5173`)로
열면 MSW 가 뜨지 않고 모든 요청이 404 가 된다.

```bash
adb reverse tcp:5173 tcp:5173   # 무선 adb 에서도 된다
# 폰에서 http://localhost:5173 으로 연다 — localhost 는 보안 컨텍스트다
```

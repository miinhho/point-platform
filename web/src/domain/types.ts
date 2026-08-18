// 도메인 타입. docs/API.md 의 계약과 일치해야 한다.
// Mock 서버와 실서버(Spring Boot + Kotlin + MySQL)가 같은 타입을 구현한다.

/** 정수. 최소 단위 1. 소수점을 허용하지 않는다. */
export type Points = number

export type UserId = string
export type PointTypeId = string
export type TransferId = string

export interface User {
  id: UserId
  /** 사람이 검증하는 것. 화면에서 가장 크게 둔다 */
  name: string
  /** `@jisu` — 계좌번호 역할. 동명이인을 가르는 유일한 문자열이다 */
  handle: string
}

/**
 * 포인트 종류.
 *
 * 발행자 한 명이 발행 권한을 가진 화폐다. 은행 하나에 포인트 하나가 대응한다.
 * 사용자는 여러 종류를 동시에 가지고, **이체는 같은 종류끼리만** 일어난다.
 */
export interface PointType {
  id: PointTypeId
  /** "온포인트" */
  name: string
  /** "ON" — 좁은 자리에서 이름 대신 쓴다 */
  symbol: string
  /** 이 포인트를 발행할 수 있는 유일한 사용자 */
  issuerId: UserId
  /**
   * 고정 표식.
   *
   * 목록에서 카드가 서로 닮으면 사용자는 매번 이름을 읽어야 한다. 발행자가 정한
   * 브랜드 색이므로 도메인 데이터다 — 화면이 임의로 배정하면 순서가 바뀔 때
   * 색도 바뀌어서 표식 노릇을 못 한다.
   */
  accent: PointAccent
  totalIssued: Points
  issueCap: Points
}

export type PointAccent = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'teal'

/** 한 사용자가 가진 한 포인트의 잔액 */
export interface Balance {
  pointType: PointType
  amount: Points
}

/** 한 사용자가 가진 포인트 전부 */
export interface Wallet {
  user: User
  balances: Balance[]
}

export type TransferKind = 'transfer' | 'issue'

export type FailureCode =
  /** 보내려는 포인트의 잔액이 부족하다 */
  | 'INSUFFICIENT_BALANCE'
  /** 발행 상한을 넘는다 */
  | 'CAP_EXCEEDED'
  /** 이 포인트의 발행자가 아니다 */
  | 'NOT_ISSUER'
  | 'RECIPIENT_NOT_FOUND'
  | 'POINT_TYPE_NOT_FOUND'
  /** 요청이 서버에 닿았는지 알 수 없다 */
  | 'NETWORK'
  | 'SERVER'

export interface Failure {
  code: FailureCode
  message: string
}

/**
 * 일어난 이체.
 *
 * **상태 필드가 없다.** 취소 창을 버리고 서버가 동기로 확정을 돌려주게 되자,
 * 저장된 이체는 언제나 확정된 것이 되었다. `status: 'pending' | 'failed'` 를 남겨
 * 두려다 지웠다 — 시스템이 만들어 낼 수 없는 값을 타입에 두면, 화면은 그 상태를
 * 그리게 되고 그 화면은 영원히 검증되지 않는다.
 *
 * 실패는 기록이 아니라 **응답**이다. 실패한 요청은 이 목록에 남지 않는다.
 * 결과를 알 수 없을 때 `GET /transfers/:id` 가 404 를 주면 일어나지 않은 것이다.
 */
export interface Transfer {
  id: TransferId
  /** 재시도를 안전하게 만드는 키. 클라이언트가 생성한다 */
  idempotencyKey: string
  kind: TransferKind
  /** 무엇을 보냈는가. 이 앱에서 금액은 이것 없이 의미가 없다 */
  pointTypeId: PointTypeId
  /** issue 는 null — 무에서 만든다 */
  fromId: UserId | null
  toId: UserId
  amount: Points
  createdAt: string
  /** 확정 시각. 이후로는 되돌릴 수 없다 */
  confirmedAt: string
}

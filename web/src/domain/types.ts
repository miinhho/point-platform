// 도메인 타입. docs/API.md 의 계약과 일치해야 한다.
// Mock 서버와 실서버(Spring Boot)가 같은 타입을 구현한다.

/** 정수. 최소 단위 1P. 소수점을 허용하지 않는다. */
export type Points = number

export type UserId = string

export type Role = 'member' | 'issuer'

export interface User {
  id: UserId
  /** 사람이 검증할 수 있는 것 (헌법 6조). 가장 크게 표시한다. */
  name: string
  /** @minho — 계좌번호 역할. 검증용이 아니므로 작게 표시한다. */
  handle: string
  role: Role
}

export interface Ledger {
  /** 총 발행량 */
  totalIssued: Points
  /** 발행 상한 (헌법 22조) */
  issueCap: Points
}

export interface Account {
  user: User
  balance: Points
  /** 전체 발행량 중 내 비중. 헌법 22조가 요구하는 유한함의 표현. */
  shareOfTotal: number
}

export type TransferKind = 'transfer' | 'issue'

/**
 * 이체 상태 기계 (docs/API.md).
 *
 *                   ┌──────────► cancelled   (cancelableUntil 이전에만)
 *                   │
 *  (요청) ──► pending ──────────► confirmed   (되돌릴 수 없음)
 *                   │
 *                   └──────────► failed
 *
 * pending 은 두 구간으로 나뉜다.
 *
 *   1. 취소 창 (~ cancelableUntil) — 아무 처리도 일어나지 않는다.
 *      취소 가능하다고 말하면서 이미 출금해 두면 그건 거짓말이다.
 *   2. 처리 중 (cancelableUntil ~) — 단계가 실제로 진행된다. 취소할 수 없다.
 */
export type TransferStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed'

export type FailureCode =
  | 'INSUFFICIENT_BALANCE'
  | 'CAP_EXCEEDED'
  | 'NOT_CANCELLABLE'
  | 'RECIPIENT_NOT_FOUND'
  | 'NETWORK'
  | 'SERVER'

export interface Failure {
  code: FailureCode
  message: string
}

/** 진행 단계 (헌법 10조). 스피너 대신 이 단계를 보여준다. */
export type ProgressStep = 'withdraw' | 'request' | 'verify' | 'deposit'

export const PROGRESS_STEPS: readonly ProgressStep[] = [
  'withdraw',
  'request',
  'verify',
  'deposit',
]

export interface Transfer {
  id: string
  /** 재시도를 안전하게 만드는 키. 클라이언트가 생성한다 (docs/API.md). */
  idempotencyKey: string
  kind: TransferKind
  /** issue 는 null — 무에서 발행된다. */
  fromId: UserId | null
  toId: UserId
  amount: Points
  memo?: string
  status: TransferStatus
  /** 서버가 실제로 완료한 단계. 클라이언트가 앞질러 표시하지 않는다 (헌법 11조). */
  completedSteps: ProgressStep[]
  createdAt: string
  /**
   * 취소 창의 끝 (헌법 9조). 이 시각까지만 취소할 수 있고,
   * 이 시각부터 실제 처리가 시작된다. 서버가 정하므로 클라이언트 시계를 신뢰하지 않는다.
   */
  cancelableUntil: string
  /** 모든 단계가 끝나 확정된 시각. 이후로는 되돌릴 수 없다. */
  confirmedAt?: string
  failure?: Failure
}

/** 확정 화면이 보여줄 "이체 후의 세계" (헌법 8조). */
export interface TransferPreview {
  from: User
  to: User
  amount: Points
  /** 이체 후 남는 잔액 */
  balanceAfter: Points
}

/** 발행 확정 화면이 보여줄 "발행 후의 세계" (헌법 24조). */
export interface IssuePreview {
  to: User
  amount: Points
  totalIssuedAfter: Points
  issueCap: Points
  /** 총 유통량 변화율. 개인의 실수와 경제의 실수는 크기가 다르다. */
  inflationRate: number
}

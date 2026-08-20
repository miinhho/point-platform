import type { Points } from './ids'
import type { PointType } from './point'
import type { User } from './user'

export interface Balance {
  pointType: PointType
  amount: Points
  /** 지금 보낼 수 있는 양. 보류금이 생기면 `amount` 와 달라진다. */
  sendable: Points
  /**
   * 이 포인트로 아직 보내지도 사지도 않았다. 서버가 판정한다 — 클라이언트가 기억하면
   * 폰에서 확인한 것이 태블릿에서는 처음이 된다. 계약: docs/API.md
   */
  neverSpent: boolean
}

export interface Wallet {
  user: User
  balances: Balance[]
}

import type { UserId } from './ids'
import type { PointType } from './point'

/**
 * 비공개 은행으로의 초대. 상태를 최소로 갖는다 — 거절도 취소도 없다.
 * 무시하면 그만이고, 거절을 두면 「거절함」이라는 상태와 그것을 되돌리는 경로가
 * 따라온다. 계약: docs/API.md
 */
export interface Invite {
  id: string
  /** 받는 사람이 판단할 것이 여기 다 있다 */
  pointType: PointType
  /** 초대한 사람. 은행장이다 */
  byId: UserId
  byHandle: string
  createdAt: string
}

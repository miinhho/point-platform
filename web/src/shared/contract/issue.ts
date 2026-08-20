import type { IssueId, Points, PointTypeId, UserId } from './ids'
import type { PointMark } from './point'

/**
 * 발행. **이체가 아니다** — 중심 필드인 「누구에게」가 없다. 한동안 `Transfer.kind` 로
 * 갈랐는데 그러면 빈 칸이 생기고, 빈 칸은 채워지려 한다: 「보낸 사람: 발행(무에서)」과
 * 「나」가 그 결과였다. 계약: docs/API.md 「발행은 이체가 아니다」
 */
export interface Issue {
  id: IssueId
  idempotencyKey: string
  pointTypeId: PointTypeId
  /** 발행자. 받는 사람이기도 하다 — 한 사람이라 칸이 하나다 */
  issuerId: UserId
  amount: Points
  /** 이 발행 **직후**의 유통량. 지금 값이 아니다 — 일어난 일은 일어난 때의 값을 갖는다 */
  totalIssuedAfter: Points
  /** 그때의 상한. 나중에 바뀌어도 이 값은 안 바뀐다 */
  issueCapAt: Points
  confirmedAt: string
}

export interface IssueDetail {
  issue: Issue
  point: PointMark
}

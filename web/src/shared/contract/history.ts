import type { PointMark } from './point'
import type { Issue } from './issue'
import type { Transfer } from './transfer'

/**
 * 내역 한 줄. 갈래를 **서버가 시간순으로 섞어 준다** — 클라이언트가 목록 여럿을
 * 받아 합치면 각 목록의 `limit` 경계에서 항목이 사라진다. (계약은 구매 갈래를 하나 더
 * 두지만 그것은 원장 6 단계라 서버가 아직 내지 않는다 — docs/API.md 「상점」)
 *
 * 상한 변경은 오지 않는다. 유통량·상한은 발행자 화면의 것이라, 줄로 남기면 보유자의
 * 내역이 발행자의 관리 기록으로 채워진다 — docs/API.md 「상한 변경은 내역에 오르지 않는다」
 */
export type HistoryEntry =
  | { type: 'transfer'; transfer: Transfer; point: PointMark }
  | { type: 'issue'; issue: Issue; point: PointMark }

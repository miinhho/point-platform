import type { PointMark } from './point'
import type { Issue } from './issue'
import type { Transfer } from './transfer'

/**
 * 내역 한 줄. 서버가 두 종류를 시간순으로 섞어 준다 — 클라이언트가 목록 여럿을
 * 받아 합치면 각 목록의 `limit` 경계에서 항목이 사라진다.
 *
 * 상한 변경은 오지 않는다. 유통량·상한은 발행자 화면의 것이라, 줄로 남기면 보유자의
 * 내역이 발행자의 관리 기록으로 채워진다 — docs/API.md 「상한 변경은 내역에 오르지 않는다」
 */
export type HistoryEntry =
  | { type: 'transfer'; transfer: Transfer; point: PointMark }
  | { type: 'issue'; issue: Issue; point: PointMark }

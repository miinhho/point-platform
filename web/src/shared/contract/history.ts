import type { CapChange, PointMark } from './point'
import type { Issue } from './issue'
import type { Transfer } from './transfer'

/**
 * 내역 한 줄. 서버가 세 종류를 시간순으로 섞어 준다 — 클라이언트가 목록 여럿을
 * 받아 합치면 각 목록의 `limit` 경계에서 항목이 사라진다.
 */
export type HistoryEntry =
  | { type: 'transfer'; transfer: Transfer; point: PointMark }
  | { type: 'issue'; issue: Issue; point: PointMark }
  | { type: 'capChange'; capChange: CapChange; point: PointMark }

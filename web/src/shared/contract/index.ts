/**
 * HTTP 계약. `docs/API.md` 가 원본이고 이 폴더는 그것을 타입으로 옮긴 것이다.
 *
 * 밖에서는 이 배럴만 본다 — 파일이 나뉜 것은 읽기 위해서지 부르는 쪽이 알 일이
 * 아니다. 실패 코드가 문서와 같은지는 `src/test/contract.test.ts` 가 잰다.
 */
export type { IssueId, Points, PointTypeId, TransferId, UserId } from './ids'
export type { User } from './user'
export { ALLOWED_EMOJI } from './point'
export type { CapChange, PointAccent, PointMark, PointType, PointVisibility } from './point'
export type { Balance, Wallet } from './wallet'
export type { Counterparty, Transfer, TransferDetail } from './transfer'
export type { Issue, IssueDetail } from './issue'
export type { Invite } from './invite'
export type { HistoryEntry } from './history'
export { FAILURE_CODES } from './failure'
export type { Failure, FailureCode, FailureOutcome } from './failure'

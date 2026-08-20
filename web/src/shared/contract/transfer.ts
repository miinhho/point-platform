import type { Points, PointTypeId, TransferId, UserId } from './ids'
import type { PointMark } from './point'

/**
 * 이체의 상대. 누구인지는 서버가 아는 사실이라 서버가 싣는다 — 클라이언트가 `toId` 로
 * 사용자 목록을 뒤지면 목록에 없는 순간 조용히 틀린다. 계약: docs/API.md
 */
export interface Counterparty {
  name: string
  handle: string
  nameIsShared: boolean
}

/** 확정된 이체만 존재한다. 실패는 기록이 아니라 응답이다 — docs/API.md */
export interface Transfer {
  id: TransferId
  idempotencyKey: string
  pointTypeId: PointTypeId
  fromId: UserId
  toId: UserId
  amount: Points
  /** 누구인지는 서버가 아는 사실이다. 화면이 목록을 뒤져 맞추면 조용히 틀린다 */
  counterparty: Counterparty
  createdAt: string
  confirmedAt: string
}

/** 단건 조회의 응답. 상세도 일어난 일이지 지금 가진 것이 아니다 */
export interface TransferDetail {
  transfer: Transfer
  point: PointMark
}

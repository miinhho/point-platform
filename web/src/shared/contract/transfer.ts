import type { Points, PointTypeId, TransferId } from './ids'
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
  /** 사건의 id 다. 부속 기록이 자기 id 를 따로 갖지 않는다 */
  id: TransferId
  idempotencyKey: string
  pointTypeId: PointTypeId
  amount: Points
  /** 누구인지는 서버가 아는 사실이다. 화면이 목록을 뒤져 맞추면 조용히 틀린다 */
  counterparty: Counterparty
  /**
   * 보는 사람이 보낸 것인가. **`fromId` · `toId` 는 오지 않는다** — 화면이 자기 id 를
   * 맞춰 보고 방향을 정하지 않는다. 상대와 방향은 같은 사실의 두 면이고 서버가 함께 싣는다.
   */
  outgoing: boolean
  /**
   * 일어난 때. 만든 때와 확정된 때가 갈리지 않는다 — 저장된 이체는 언제나 확정이라
   * 둘이 같은 값이었다. 근거: docs/LEDGER.md 「거래일과 기표일을 나누지 않는다」
   */
  occurredAt: string
}

/** 단건 조회의 응답. 상세도 일어난 일이지 지금 가진 것이 아니다 */
export interface TransferDetail {
  transfer: Transfer
  point: PointMark
}

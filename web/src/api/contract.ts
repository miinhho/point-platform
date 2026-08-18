// 계약: docs/API.md

/** 정수. 최소 단위 1. 소수점을 허용하지 않는다. */
export type Points = number

export type UserId = string
export type PointTypeId = string
export type TransferId = string

export interface User {
  id: UserId
  name: string
  /** 동명이인을 가르는 유일한 문자열. */
  handle: string
  /** 원장 전체에서 이 이름을 쓰는 사용자가 둘 이상인가. 받은 목록 안에서 세면 방어가 꺼진다. */
  nameIsShared: boolean
}

/** 발행자 한 명이 발행 권한을 가진 화폐. 이체는 같은 종류끼리만 일어난다. */
export interface PointType {
  id: PointTypeId
  name: string
  /** 좁은 자리에서 이름 대신 쓴다. */
  symbol: string
  issuerId: UserId
  /** 이름이 겹치는 포인트를 가르는 부제. 화면이 사용자 목록을 뒤지지 않게 서버가 준다. */
  issuerName: string
  /** 원장 전체에서 이 이름을 쓰는 포인트가 둘 이상인가. 내 지갑에는 한쪽만 올 수 있다. */
  nameIsShared: boolean
  /** 내가 이 포인트를 발행할 수 있는가. 클라이언트가 판정하지 않는다. */
  canIssue: boolean
  /** 지금 더 발행할 수 있는 양. 상한 외의 규칙이 생기면 서버만 안다. */
  issuableHeadroom: Points
  /** 발행자가 정한 색. 화면이 배정하면 순서가 바뀔 때 표식 노릇을 못 한다. */
  accent: PointAccent
  totalIssued: Points
  issueCap: Points
}

export type PointAccent = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'teal'

export interface Balance {
  pointType: PointType
  amount: Points
  /** 지금 보낼 수 있는 양. 보류금이 생기면 `amount` 와 달라진다. */
  sendable: Points
}

export interface Wallet {
  user: User
  balances: Balance[]
}

export type TransferKind = 'transfer' | 'issue'

/**
 * 런타임 목록이 진실이고 타입은 여기서 파생된다. 둘을 따로 두면 코드를 추가할 때
 * 한쪽을 빠뜨리고, 그러면 서버가 보낸 코드가 조용히 `SERVER` 로 떨어진다.
 */
export const FAILURE_CODES = [
  /** 핸들이나 암호가 틀렸다 */
  'BAD_CREDENTIALS',
  /** 토큰이 없거나 만료됐다. 화면은 로그인으로 보낸다 */
  'UNAUTHENTICATED',
  'INSUFFICIENT_BALANCE',
  'CAP_EXCEEDED',
  'NOT_ISSUER',
  'RECIPIENT_NOT_FOUND',
  'POINT_TYPE_NOT_FOUND',
  /** 그 기호를 이미 쓰는 포인트가 있다 */
  'SYMBOL_TAKEN',
  /** 이미 발행한 양보다 낮은 상한 */
  'CAP_BELOW_ISSUED',
  /** 결과를 알 수 없다. 이 둘만 그렇다 */
  'NETWORK',
  'SERVER',
] as const

export type FailureCode = (typeof FAILURE_CODES)[number]

export interface Failure {
  code: FailureCode
  message: string
}

/** 확정된 이체만 존재한다. 실패는 기록이 아니라 응답이다 — docs/API.md */
export interface Transfer {
  id: TransferId
  idempotencyKey: string
  kind: TransferKind
  pointTypeId: PointTypeId
  /** issue 는 null. */
  fromId: UserId | null
  toId: UserId
  amount: Points
  createdAt: string
  confirmedAt: string
}

/**
 * 상한이 바뀐 사건. 되돌리는 것이 아니라 또 하나의 변경으로만 이어진다 —
 * docs/JOURNEY.md 여정 9
 */
export interface CapChange {
  id: string
  idempotencyKey: string
  pointTypeId: PointTypeId
  /** 바꾼 사람. 그 포인트의 발행자다 */
  byId: UserId
  previousCap: Points
  issueCap: Points
  changedAt: string
}

/**
 * 내역 한 줄. 서버가 두 종류를 시간순으로 섞어 준다 — 클라이언트가 두 목록을
 * 받아 합치면 각 목록의 `limit` 경계에서 항목이 사라진다.
 *
 * `Transfer.kind` 와는 다른 것이다. 그쪽은 이체냐 발행이냐를 가른다.
 */
export type HistoryEntry =
  | { type: 'transfer'; transfer: Transfer }
  | { type: 'capChange'; capChange: CapChange }

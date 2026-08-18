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
}

/** 발행자 한 명이 발행 권한을 가진 화폐. 이체는 같은 종류끼리만 일어난다. */
export interface PointType {
  id: PointTypeId
  name: string
  /** 좁은 자리에서 이름 대신 쓴다. */
  symbol: string
  issuerId: UserId
  /** 발행자가 정한 색. 화면이 배정하면 순서가 바뀔 때 표식 노릇을 못 한다. */
  accent: PointAccent
  totalIssued: Points
  issueCap: Points
}

export type PointAccent = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'teal'

export interface Balance {
  pointType: PointType
  amount: Points
}

export interface Wallet {
  user: User
  balances: Balance[]
}

export type TransferKind = 'transfer' | 'issue'

export type FailureCode =
  | 'INSUFFICIENT_BALANCE'
  | 'CAP_EXCEEDED'
  | 'NOT_ISSUER'
  | 'RECIPIENT_NOT_FOUND'
  | 'POINT_TYPE_NOT_FOUND'
  /** 결과를 알 수 없다. NETWORK·SERVER 만 여기 해당한다. */
  | 'NETWORK'
  | 'SERVER'

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

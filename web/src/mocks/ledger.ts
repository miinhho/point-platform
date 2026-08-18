import type {
  PointType,
  PointTypeId,
  Points,
  Transfer,
  TransferId,
  User,
  UserId,
} from '@/domain/types'

// 인메모리 원장. 잔액은 (pointTypeId, userId) 단위다.
export const ME: UserId = 'u_minho'

export class LedgerError extends Error {
  readonly code: LedgerErrorCode

  constructor(code: LedgerErrorCode) {
    super(code)
    this.name = 'LedgerError'
    this.code = code
  }
}

export type LedgerErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'CAP_EXCEEDED'
  | 'NOT_ISSUER'
  | 'RECIPIENT_NOT_FOUND'
  | 'POINT_TYPE_NOT_FOUND'

function seedUsers(): User[] {
  return [
    { id: ME, name: '장민호', handle: '@minho' },
    { id: 'u_jisoo', name: '김지수', handle: '@jisoo' },
    { id: 'u_taeyun', name: '박태윤', handle: '@taeyun' },
    { id: 'u_seoyeon', name: '이서연', handle: '@seoyeon' },
    { id: 'u_junho', name: '최준호', handle: '@junho' },
    // 이름이 겹치는 사용자를 일부러 넣는다. 막으려는 실수가 실제로 가능한
    // 원장이어야 검증에 의미가 있다.
    { id: 'u_jisu', name: '김지수', handle: '@jisu' },
    { id: 'u_onmart', name: '온마트', handle: '@onmart' },
    { id: 'u_solcafe', name: '솔카페', handle: '@solcafe' },
  ]
}

/** 하나는 내가 발행자, 둘은 보유자다. 그 조합이 실제 상태다. */
function seedPointTypes(): PointType[] {
  return [
    {
      id: 'pt_on',
      name: '온포인트',
      symbol: 'ON',
      issuerId: 'u_onmart',
      accent: 'blue',
      totalIssued: 50_000_000,
      issueCap: 100_000_000,
    },
    {
      id: 'pt_sol',
      name: '솔포인트',
      symbol: 'SL',
      issuerId: 'u_solcafe',
      accent: 'green',
      totalIssued: 8_000_000,
      issueCap: 20_000_000,
    },
    {
      id: 'pt_gm',
      name: '금머니',
      symbol: 'GM',
      issuerId: ME,
      accent: 'purple',
      totalIssued: 1_200_000,
      issueCap: 10_000_000,
    },
  ]
}

/** `${pointTypeId}:${userId}` → 잔액 */
type BalanceKey = string
const balanceKey = (pointTypeId: PointTypeId, userId: UserId): BalanceKey =>
  `${pointTypeId}:${userId}`

function seedBalances(): Map<BalanceKey, Points> {
  return new Map<BalanceKey, Points>([
    [balanceKey('pt_on', ME), 3_240_000],
    [balanceKey('pt_on', 'u_jisoo'), 812_000],
    [balanceKey('pt_on', 'u_taeyun'), 1_450_000],
    [balanceKey('pt_on', 'u_junho'), 27_800],
    [balanceKey('pt_sol', ME), 87_500],
    [balanceKey('pt_sol', 'u_seoyeon'), 240_000],
    [balanceKey('pt_gm', ME), 620_000],
    [balanceKey('pt_gm', 'u_jisu'), 45_000],
  ])
}

/** 포인트별로 다르다. */
function seedRecent(): Map<PointTypeId, UserId[]> {
  return new Map<PointTypeId, UserId[]>([
    ['pt_on', ['u_jisoo', 'u_taeyun', 'u_junho']],
    ['pt_sol', ['u_seoyeon']],
    ['pt_gm', ['u_jisu']],
  ])
}

interface State {
  users: Map<UserId, User>
  pointTypes: Map<PointTypeId, PointType>
  balances: Map<BalanceKey, Points>
  transfers: Map<TransferId, Transfer>
  /** 멱등성 키 → 이체 id */
  byKey: Map<string, TransferId>
  /** 최신순 */
  order: TransferId[]
  recent: Map<PointTypeId, UserId[]>
}

function initialState(): State {
  return {
    users: new Map(seedUsers().map((user) => [user.id, user])),
    pointTypes: new Map(seedPointTypes().map((type) => [type.id, type])),
    balances: seedBalances(),
    transfers: new Map(),
    byKey: new Map(),
    order: [],
    recent: seedRecent(),
  }
}

let state = initialState()

export function resetLedger(): void {
  state = initialState()
}

export function me(): User {
  return state.users.get(ME)!
}

export function allUsers(): User[] {
  return [...state.users.values()]
}

export function allPointTypes(): PointType[] {
  return [...state.pointTypes.values()]
}

export function balanceOf(pointTypeId: PointTypeId, userId: UserId): Points {
  return state.balances.get(balanceKey(pointTypeId, userId)) ?? 0
}

/** 잔액 0 도 발행자라면 포함한다. 걸러 내면 화면이 그 상태를 표현할 수 없다. */
export function balancesOf(userId: UserId) {
  return allPointTypes()
    .map((pointType) => ({ pointType, amount: balanceOf(pointType.id, userId) }))
    .filter(({ pointType, amount }) => amount > 0 || pointType.issuerId === userId)
}

/** 결과에 동명이인을 함께 담는다. 겹침은 결과의 성질이 아니라 원장의 성질이다. */
export function searchUsers(query: string | null): User[] {
  const others = allUsers().filter((user) => user.id !== ME)
  if (!query?.trim()) return others

  const needle = query.trim().toLowerCase()
  const matched = others.filter(
    (user) => user.name.includes(needle) || user.handle.toLowerCase().includes(needle),
  )
  const names = new Set(matched.map((user) => user.name))
  return others.filter((user) => names.has(user.name))
}

export function recentFor(pointTypeId: PointTypeId, limit: number): User[] {
  return (state.recent.get(pointTypeId) ?? [])
    .slice(0, limit)
    .map((id) => state.users.get(id))
    .filter((user): user is User => user !== undefined)
}

export function findByIdempotencyKey(key: string): Transfer | undefined {
  const id = state.byKey.get(key)
  return id ? state.transfers.get(id) : undefined
}

export function findTransfer(id: TransferId): Transfer | undefined {
  return state.transfers.get(id)
}

export function history(pointTypeId: PointTypeId | null, limit: number): Transfer[] {
  return state.order
    .map((id) => state.transfers.get(id)!)
    .filter((transfer) => !pointTypeId || transfer.pointTypeId === pointTypeId)
    .slice(0, limit)
}

export interface CommitInput {
  idempotencyKey: string
  pointTypeId: PointTypeId
  toId: UserId
  amount: Points
}

/** 검증과 반영이 한 순간에 일어난다. 중간 상태가 없다. */
export function commitTransfer(input: CommitInput): Transfer {
  const pointType = requirePointType(input.pointTypeId)
  const recipient = requireRecipient(input.toId)

  if (input.amount > balanceOf(pointType.id, ME)) {
    throw new LedgerError('INSUFFICIENT_BALANCE')
  }

  move(pointType.id, ME, -input.amount)
  move(pointType.id, recipient.id, input.amount)
  return record('transfer', pointType.id, ME, recipient.id, input)
}

/** 발행한다. 무에서 만들고 총 유통량이 늘어난다. */
export function commitIssue(input: CommitInput): Transfer {
  const pointType = requirePointType(input.pointTypeId)
  const recipient = requireRecipient(input.toId)

  if (pointType.issuerId !== ME) throw new LedgerError('NOT_ISSUER')
  if (pointType.totalIssued + input.amount > pointType.issueCap) {
    throw new LedgerError('CAP_EXCEEDED')
  }

  state.pointTypes.set(pointType.id, {
    ...pointType,
    totalIssued: pointType.totalIssued + input.amount,
  })
  move(pointType.id, recipient.id, input.amount)
  return record('issue', pointType.id, null, recipient.id, input)
}

function requirePointType(pointTypeId: PointTypeId): PointType {
  const pointType = state.pointTypes.get(pointTypeId)
  if (!pointType) throw new LedgerError('POINT_TYPE_NOT_FOUND')
  return pointType
}

function requireRecipient(toId: UserId): User {
  const recipient = state.users.get(toId)
  if (!recipient) throw new LedgerError('RECIPIENT_NOT_FOUND')
  return recipient
}

function move(pointTypeId: PointTypeId, userId: UserId, delta: Points): void {
  state.balances.set(balanceKey(pointTypeId, userId), balanceOf(pointTypeId, userId) + delta)
}

function record(
  kind: 'transfer' | 'issue',
  pointTypeId: PointTypeId,
  fromId: UserId | null,
  toId: UserId,
  input: CommitInput,
): Transfer {
  const now = new Date().toISOString()
  const transfer: Transfer = {
    id: `t_${state.order.length + 1}_${input.idempotencyKey.slice(0, 8)}`,
    idempotencyKey: input.idempotencyKey,
    kind,
    pointTypeId,
    fromId,
    toId,
    amount: input.amount,
    createdAt: now,
    confirmedAt: now,
  }

  state.transfers.set(transfer.id, transfer)
  state.byKey.set(input.idempotencyKey, transfer.id)
  state.order.unshift(transfer.id)

  const previous = state.recent.get(pointTypeId) ?? []
  state.recent.set(pointTypeId, [toId, ...previous.filter((id) => id !== toId)])

  return transfer
}

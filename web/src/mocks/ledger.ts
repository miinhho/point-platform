import type {
  PointAccent,
  PointType,
  PointTypeId,
  Points,
  Transfer,
  TransferId,
  User,
  UserId,
} from '@/api/contract'

// 인메모리 원장. 잔액은 (pointTypeId, userId) 단위다.
/** 시드에서 발행 권한을 가진 사용자. 테스트가 기준점으로 쓴다 */
export const SEED_ISSUER: UserId = 'u_minho'

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
  | 'SYMBOL_TAKEN'

/** 겹침은 원장을 봐야 알 수 있다. 시드가 들고 있으면 사용자가 늘 때 거짓이 된다. */
type SeedUser = Omit<User, 'nameIsShared'>

function seedUsers(): SeedUser[] {
  return [
    { id: SEED_ISSUER, name: '장민호', handle: '@minho' },
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
type SeedPoint = Omit<PointType, 'canIssue' | 'issuableHeadroom' | 'nameIsShared'>

function seedPointTypes(): SeedPoint[] {
  return [
    {
      id: 'pt_on',
      name: '온포인트',
      symbol: 'ON',
      issuerId: 'u_onmart',
      issuerName: '온마트',
      accent: 'blue',
      totalIssued: 50_000_000,
      issueCap: 100_000_000,
    },
    {
      id: 'pt_sol',
      name: '솔포인트',
      symbol: 'SL',
      issuerId: 'u_solcafe',
      issuerName: '솔카페',
      accent: 'green',
      totalIssued: 8_000_000,
      issueCap: 20_000_000,
    },
    {
      id: 'pt_gm',
      name: '금머니',
      symbol: 'GM',
      issuerId: SEED_ISSUER,
      issuerName: '장민호',
      accent: 'purple',
      totalIssued: 1_200_000,
      issueCap: 10_000_000,
    },
    // 이름이 겹치는 포인트를 일부러 둔다. 김지수를 둘 심은 것과 같은 이유다.
    {
      id: 'pt_on2',
      name: '온포인트',
      symbol: 'OP',
      issuerId: 'u_solcafe',
      issuerName: '솔카페',
      accent: 'teal',
      totalIssued: 300_000,
      issueCap: 5_000_000,
    },
  ]
}

/** `${pointTypeId}:${userId}` → 잔액 */
type BalanceKey = string
const balanceKey = (pointTypeId: PointTypeId, userId: UserId): BalanceKey =>
  `${pointTypeId}:${userId}`

function seedBalances(): Map<BalanceKey, Points> {
  return new Map<BalanceKey, Points>([
    [balanceKey('pt_on', SEED_ISSUER), 3_240_000],
    [balanceKey('pt_on', 'u_jisoo'), 812_000],
    [balanceKey('pt_on', 'u_taeyun'), 1_450_000],
    [balanceKey('pt_on', 'u_junho'), 27_800],
    [balanceKey('pt_sol', SEED_ISSUER), 87_500],
    [balanceKey('pt_sol', 'u_seoyeon'), 240_000],
    [balanceKey('pt_gm', SEED_ISSUER), 620_000],
    [balanceKey('pt_gm', 'u_jisu'), 45_000],
    [balanceKey('pt_on2', SEED_ISSUER), 12_000],
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
  users: Map<UserId, SeedUser>
  pointTypes: Map<PointTypeId, SeedPoint>
  balances: Map<BalanceKey, Points>
  transfers: Map<TransferId, Transfer>
  /** `${요청자}:${멱등성 키}` → 이체 id. 남의 키로 남의 이체를 꺼낼 수 없다 */
  byKey: Map<string, TransferId>
  /** 멱등성 키 → 창설된 포인트 id. 창설도 되돌릴 수 없으므로 두 번 만들지 않는다 */
  createdByKey: Map<string, PointTypeId>
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
    createdByKey: new Map(),
    order: [],
    recent: seedRecent(),
  }
}

let state = initialState()

export function resetLedger(): void {
  state = initialState()
}

export function userById(userId: UserId): User | undefined {
  const user = state.users.get(userId)
  return user && userViewOf(user)
}

export function allUsers(): User[] {
  return [...state.users.values()].map(userViewOf)
}

/**
 * 겹침은 응답의 성질이 아니라 원장의 성질이다 — 계약: docs/API.md.
 * 한쪽만 담긴 응답에서 클라이언트가 세면 방어가 조용히 꺼진다.
 */
function sharesName(name: string, among: readonly { name: string }[]): boolean {
  return among.filter((other) => other.name === name).length > 1
}

function userViewOf(user: SeedUser): User {
  return { ...user, nameIsShared: sharesName(user.name, [...state.users.values()]) }
}

function seedPoints(): SeedPoint[] {
  return [...state.pointTypes.values()]
}

export function pointTypesFor(userId: UserId): PointType[] {
  return seedPoints().map((pointType) => viewOf(pointType, userId))
}

export function balanceOf(pointTypeId: PointTypeId, userId: UserId): Points {
  return state.balances.get(balanceKey(pointTypeId, userId)) ?? 0
}

/** 잔액 0 도 발행자라면 포함한다. 걸러 내면 화면이 그 상태를 표현할 수 없다. */
export function balancesOf(userId: UserId) {
  return seedPoints()
    .map((pointType) => {
      const amount = balanceOf(pointType.id, userId)
      // 규칙을 서버가 계산해 실어 준다. 클라이언트가 같은 뺄셈을 다시 하지 않게.
      return { pointType: viewOf(pointType, userId), amount, sendable: amount }
    })
    .filter(({ pointType, amount }) => amount > 0 || pointType.canIssue)
}

/** 요청자 기준으로 본 포인트. 권한과 여력은 보는 사람에 따라 다르다. */
export function viewOf(pointType: SeedPoint, userId: UserId): PointType {
  return {
    ...pointType,
    canIssue: pointType.issuerId === userId,
    issuableHeadroom: Math.max(0, pointType.issueCap - pointType.totalIssued),
    nameIsShared: sharesName(pointType.name, seedPoints()),
  }
}

/** 결과에 동명이인을 함께 담는다. 겹침은 결과의 성질이 아니라 원장의 성질이다. */
export function searchUsers(query: string | null, meId: UserId): User[] {
  const others = allUsers().filter((user) => user.id !== meId)
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
    .map((id) => userById(id))
    .filter((user): user is User => user !== undefined)
}

/** 이체는 관여한 사람만 읽는다 — 계약: docs/API.md */
const involves = (transfer: Transfer, meId: UserId): boolean =>
  transfer.fromId === meId || transfer.toId === meId

const idempotencyScope = (meId: UserId, key: string): string => `${meId}:${key}`

export function findByIdempotencyKey(key: string, meId: UserId): Transfer | undefined {
  const id = state.byKey.get(idempotencyScope(meId, key))
  return id ? state.transfers.get(id) : undefined
}

/** 남의 것은 없는 것과 같다. 있다고 알려 주면 그 id 가 존재한다는 답이 된다. */
export function findTransfer(id: TransferId, meId: UserId): Transfer | undefined {
  const transfer = state.transfers.get(id)
  return transfer && involves(transfer, meId) ? transfer : undefined
}

/** 내가 관여한 것만. 남의 이체가 내 내역에 보이면 안 된다 */
export function history(meId: UserId, pointTypeId: PointTypeId | null, limit: number): Transfer[] {
  return state.order
    .map((id) => state.transfers.get(id)!)
    .filter((transfer) => involves(transfer, meId))
    .filter((transfer) => !pointTypeId || transfer.pointTypeId === pointTypeId)
    .slice(0, limit)
}

export interface CreatePointTypeInput {
  idempotencyKey: string
  name: string
  symbol: string
  accent: PointAccent
  issueCap: Points
}

/**
 * 만든 사람이 발행자다. 자격을 심사하지 않는다 — docs/JOURNEY.md 여정 9.
 * 형식 검사는 HTTP 경계가 하고 여기서는 원장의 불변식만 본다.
 */
export function createPointType(meId: UserId, input: CreatePointTypeInput): PointType {
  const existing = state.createdByKey.get(input.idempotencyKey)
  if (existing) return viewOf(state.pointTypes.get(existing)!, meId)

  const symbol = input.symbol.toUpperCase()
  if (seedPoints().some((pointType) => pointType.symbol === symbol)) {
    throw new LedgerError('SYMBOL_TAKEN')
  }

  const issuer = state.users.get(meId)
  if (!issuer) throw new LedgerError('RECIPIENT_NOT_FOUND')

  const created: SeedPoint = {
    id: `pt_${symbol.toLowerCase()}_${state.pointTypes.size + 1}`,
    name: input.name.trim(),
    symbol,
    issuerId: meId,
    issuerName: issuer.name,
    accent: input.accent,
    totalIssued: 0,
    issueCap: input.issueCap,
  }
  state.pointTypes.set(created.id, created)
  state.createdByKey.set(input.idempotencyKey, created.id)
  return viewOf(created, meId)
}

export interface CommitInput {
  idempotencyKey: string
  pointTypeId: PointTypeId
  toId: UserId
  amount: Points
}

/** 검증과 반영이 한 순간에 일어난다. 중간 상태가 없다. */
export function commitTransfer(meId: UserId, input: CommitInput): Transfer {
  const pointType = requirePointType(input.pointTypeId)
  const recipient = requireRecipient(input.toId)

  if (input.amount > balanceOf(pointType.id, meId)) {
    throw new LedgerError('INSUFFICIENT_BALANCE')
  }

  move(pointType.id, meId, -input.amount)
  move(pointType.id, recipient.id, input.amount)
  return record(meId, 'transfer', pointType.id, meId, recipient.id, input)
}

/** 발행한다. 무에서 만들고 총 유통량이 늘어난다. */
export function commitIssue(meId: UserId, input: CommitInput): Transfer {
  const pointType = requirePointType(input.pointTypeId)
  const recipient = requireRecipient(input.toId)

  if (pointType.issuerId !== meId) throw new LedgerError('NOT_ISSUER')
  if (pointType.totalIssued + input.amount > pointType.issueCap) {
    throw new LedgerError('CAP_EXCEEDED')
  }

  state.pointTypes.set(pointType.id, {
    ...pointType,
    totalIssued: pointType.totalIssued + input.amount,
  })
  move(pointType.id, recipient.id, input.amount)
  return record(meId, 'issue', pointType.id, null, recipient.id, input)
}

function requirePointType(pointTypeId: PointTypeId): SeedPoint {
  const pointType = state.pointTypes.get(pointTypeId)
  if (!pointType) throw new LedgerError('POINT_TYPE_NOT_FOUND')
  return pointType
}

function requireRecipient(toId: UserId): SeedUser {
  const recipient = state.users.get(toId)
  if (!recipient) throw new LedgerError('RECIPIENT_NOT_FOUND')
  return recipient
}

function move(pointTypeId: PointTypeId, userId: UserId, delta: Points): void {
  state.balances.set(balanceKey(pointTypeId, userId), balanceOf(pointTypeId, userId) + delta)
}

function record(
  meId: UserId,
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
  state.byKey.set(idempotencyScope(meId, input.idempotencyKey), transfer.id)
  state.order.unshift(transfer.id)

  const previous = state.recent.get(pointTypeId) ?? []
  state.recent.set(pointTypeId, [toId, ...previous.filter((id) => id !== toId)])

  return transfer
}

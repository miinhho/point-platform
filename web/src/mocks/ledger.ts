import type {
  CapChange,
  HistoryEntry,
  Invite,
  PointAccent,
  PointVisibility,
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
  | 'CAP_BELOW_ISSUED'
  | 'ISSUER_CANNOT_LEAVE'
  | 'NOT_MEMBER'
  | 'NOT_A_PRIVATE_BANK'

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
type SeedPoint = Omit<
  PointType,
  'canIssue' | 'issuableHeadroom' | 'nameIsShared' | 'memberCount'
>

function seedPointTypes(): SeedPoint[] {
  return [
    {
      id: 'pt_on',
      name: '온포인트',
      symbol: 'ON',
      issuerId: 'u_onmart',
      issuerName: '온마트',
      issuerHandle: '@onmart',
      accent: 'blue',
      totalIssued: 50_000_000,
      issueCap: 100_000_000,
      createdAt: '2023-03-14T09:00:00.000Z',
      visibility: 'public',
    },
    {
      id: 'pt_sol',
      name: '솔포인트',
      symbol: 'SL',
      issuerId: 'u_solcafe',
      issuerName: '솔카페',
      issuerHandle: '@solcafe',
      accent: 'green',
      totalIssued: 8_000_000,
      issueCap: 20_000_000,
      createdAt: '2024-01-08T02:30:00.000Z',
      visibility: 'public',
    },
    {
      id: 'pt_gm',
      name: '금머니',
      symbol: 'GM',
      issuerId: SEED_ISSUER,
      issuerName: '장민호',
      issuerHandle: '@minho',
      accent: 'purple',
      totalIssued: 1_200_000,
      issueCap: 10_000_000,
      createdAt: '2025-06-02T11:20:00.000Z',
      visibility: 'public',
    },
    // 비공개 은행 둘. 하나는 내가 은행장이고 하나는 회원일 뿐이다 — 그 조합이 실제 상태다.
    {
      id: 'pt_cl',
      name: '동아리회비',
      symbol: 'CL',
      issuerId: SEED_ISSUER,
      issuerName: '장민호',
      issuerHandle: '@minho',
      accent: 'pink',
      totalIssued: 400_000,
      issueCap: 2_000_000,
      createdAt: '2026-02-11T01:00:00.000Z',
      visibility: 'private',
    },
    {
      id: 'pt_hd',
      name: '한동네',
      symbol: 'HD',
      issuerId: 'u_solcafe',
      issuerName: '솔카페',
      issuerHandle: '@solcafe',
      accent: 'orange',
      totalIssued: 900_000,
      issueCap: 3_000_000,
      createdAt: '2025-11-04T08:00:00.000Z',
      visibility: 'private',
    },
    // 이름이 겹치는 포인트를 일부러 둔다. 김지수를 둘 심은 것과 같은 이유다.
    {
      id: 'pt_on2',
      name: '온포인트',
      symbol: 'OP',
      issuerId: 'u_solcafe',
      issuerName: '솔카페',
      issuerHandle: '@solcafe',
      accent: 'teal',
      totalIssued: 300_000,
      issueCap: 5_000_000,
      createdAt: '2026-07-30T05:10:00.000Z',
      visibility: 'public',
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
    [balanceKey('pt_cl', SEED_ISSUER), 50_000],
    [balanceKey('pt_cl', 'u_jisoo'), 30_000],
    [balanceKey('pt_hd', SEED_ISSUER), 25_000],
    [balanceKey('pt_hd', 'u_taeyun'), 60_000],
  ])
}

/**
 * 이미 한 번이라도 보낸 (포인트, 사용자). 여기 없으면 아직 판단하지 않은 것이다 —
 * 표시를 지우는 것은 실제로 그 포인트를 쓴 일뿐이다. 근거: docs/JOURNEY.md 여정 10
 */
function seedSpent(): Set<BalanceKey> {
  // 받기만 하고 아직 써 보지 않은 포인트가 하나는 있어야 그 표시가 검증된다.
  const fresh = balanceKey('pt_on2', SEED_ISSUER)
  return new Set([...seedBalances().keys()].filter((key) => key !== fresh))
}

/**
 * 비공개 은행의 회원. 공개 은행에는 회원 개념이 없다 — 관문이 없는데 통과 기록을
 * 두면 그것은 공개가 아니다. 계약: docs/API.md
 */
function seedMembers(): Map<PointTypeId, Set<UserId>> {
  return new Map<PointTypeId, Set<UserId>>([
    ['pt_cl', new Set([SEED_ISSUER, 'u_jisoo'])],
    ['pt_hd', new Set(['u_solcafe', SEED_ISSUER, 'u_taeyun'])],
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
  /** 「처음이에요」 표시가 꺼진 (포인트, 사용자). 발행은 쓰는 것이 아니라 넣지 않는다 */
  spent: Set<BalanceKey>
  transfers: Map<TransferId, Transfer>
  /** `${요청자}:${멱등성 키}` → 이체 id. 남의 키로 남의 이체를 꺼낼 수 없다 */
  byKey: Map<string, TransferId>
  /** 멱등성 키 → 창설된 포인트 id. 창설도 되돌릴 수 없으므로 두 번 만들지 않는다 */
  createdByKey: Map<string, PointTypeId>
  /** 최신순 */
  order: TransferId[]
  /** 최신순. 이체와 섞여 내역이 된다 */
  capChanges: CapChange[]
  /** 비공개 은행의 회원. 은행장은 언제나 여기 있다 */
  members: Map<PointTypeId, Set<UserId>>
  /** 받은 초대. 수락하면 사라진다 — 거절도 취소도 없다 */
  invites: Map<string, SeedInvite>
  /** `${요청자}:${멱등성 키}` → 초대 id */
  invitedByKey: Map<string, string>
  recent: Map<PointTypeId, UserId[]>
}

function initialState(): State {
  return {
    users: new Map(seedUsers().map((user) => [user.id, user])),
    pointTypes: new Map(seedPointTypes().map((type) => [type.id, type])),
    balances: seedBalances(),
    spent: seedSpent(),
    transfers: new Map(),
    byKey: new Map(),
    createdByKey: new Map(),
    order: [],
    capChanges: [],
    members: seedMembers(),
    invites: new Map(),
    invitedByKey: new Map(),
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
  return seedPoints()
    .filter((pointType) => reachable(pointType, userId))
    .map((pointType) => viewOf(pointType, userId))
}

/**
 * 은행 페이지가 읽는다. 공개 은행은 안 가진 사람도 보고, 비공개 은행은 회원이
 * 아니면 없는 것과 같다 — 계약: docs/API.md
 */
export function findPointType(pointTypeId: PointTypeId, userId: UserId): PointType | undefined {
  const pointType = state.pointTypes.get(pointTypeId)
  return pointType && reachable(pointType, userId) ? viewOf(pointType, userId) : undefined
}

/**
 * 그 사람에게 이 은행이 존재하는가. `404` 는 **존재를 감추는 규칙**이지 회원을
 * 가르는 규칙이 아니다 — 잔액 행이 있다는 것은 이미 닿았다는 증거이고, 이미 아는
 * 것을 감추면 감춰지는 것이 아니라 고장난 것처럼 보인다. 계약: docs/API.md
 */
function reachable(pointType: SeedPoint, userId: UserId): boolean {
  return (
    pointType.visibility === 'public' ||
    isMember(pointType.id, userId) ||
    isInvited(pointType.id, userId) ||
    balanceOf(pointType.id, userId) > 0
  )
}

export function isMember(pointTypeId: PointTypeId, userId: UserId): boolean {
  return state.members.get(pointTypeId)?.has(userId) ?? false
}

/** 초대받은 사람도 은행 페이지를 본다 — 거기가 판단하는 자리다 (여정 10) */
function isInvited(pointTypeId: PointTypeId, userId: UserId): boolean {
  return [...state.invites.values()].some(
    (invite) => invite.pointTypeId === pointTypeId && invite.toId === userId,
  )
}

/**
 * 이 포인트를 지금 쓸 수 있는가. 나간 사람·내보내진 사람의 잔액은 그대로 남지만
 * 쓸 수 없다 — 잔액을 지우거나 옮기지 않는다. 계약: docs/API.md
 */
function usable(pointType: SeedPoint, userId: UserId): boolean {
  return pointType.visibility === 'public' || isMember(pointType.id, userId)
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
      return {
        pointType: viewOf(pointType, userId),
        amount,
        // 쓸 수 없는 잔액은 보낼 수 있는 양이 0 이다. 규칙 판정을 화면이 다시 하지 않게.
        sendable: usable(pointType, userId) ? amount : 0,
        neverSpent: !state.spent.has(balanceKey(pointType.id, userId)),
      }
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
    // 공개 은행에는 회원 개념이 없다. 0 이 아니라 null 이어야 그 차이가 남는다.
    memberCount:
      pointType.visibility === 'private' ? (state.members.get(pointType.id)?.size ?? 0) : null,
  }
}

/**
 * 결과에 동명이인을 함께 담는다. 겹침은 결과의 성질이 아니라 원장의 성질이다.
 *
 * `pointTypeId` 가 오면 그 포인트로 보낼 수 있는 사람만 담는다 — 비공개 은행이면
 * 회원뿐이다. 애초에 안 뜨게 하는 것이 「회원이 아니에요」라고 말하는 것보다 낫다.
 */
export function searchUsers(
  query: string | null,
  meId: UserId,
  pointTypeId: PointTypeId | null,
): User[] {
  const bank = pointTypeId ? state.pointTypes.get(pointTypeId) : undefined
  const others = allUsers().filter(
    (user) => user.id !== meId && (!bank || usable(bank, user.id)),
  )
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

/**
 * 이체는 관여한 사람만, 상한 변경은 그 포인트를 가진 사람이 본다 — 계약: docs/API.md.
 * 서버가 섞어서 준다. 두 목록을 클라이언트가 합치면 각 limit 경계에서 항목이 사라진다.
 */
export function history(meId: UserId, pointTypeId: PointTypeId | null, limit: number): HistoryEntry[] {
  const transfers: HistoryEntry[] = state.order
    .map((id) => state.transfers.get(id)!)
    .filter((transfer) => involves(transfer, meId))
    .map((transfer) => ({ type: 'transfer', transfer }))

  const held = new Set(balancesOf(meId).map(({ pointType }) => pointType.id))
  const caps: HistoryEntry[] = state.capChanges
    .filter((capChange) => held.has(capChange.pointTypeId))
    .map((capChange) => ({ type: 'capChange', capChange }))

  return [...transfers, ...caps]
    .filter((entry) => !pointTypeId || pointTypeIdOf(entry) === pointTypeId)
    .sort((a, b) => timeOf(b).localeCompare(timeOf(a)))
    .slice(0, limit)
}

const pointTypeIdOf = (entry: HistoryEntry): PointTypeId =>
  entry.type === 'transfer' ? entry.transfer.pointTypeId : entry.capChange.pointTypeId

const timeOf = (entry: HistoryEntry): string =>
  entry.type === 'transfer' ? entry.transfer.confirmedAt : entry.capChange.changedAt

export interface CreatePointTypeInput {
  idempotencyKey: string
  name: string
  symbol: string
  accent: PointAccent
  issueCap: Points
  visibility: PointVisibility
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
    issuerHandle: issuer.handle,
    accent: input.accent,
    totalIssued: 0,
    issueCap: input.issueCap,
    createdAt: new Date().toISOString(),
    visibility: input.visibility,
  }
  state.pointTypes.set(created.id, created)
  state.createdByKey.set(input.idempotencyKey, created.id)
  // 은행장은 언제나 회원이다. 아니면 자기가 만든 은행에 닿을 수 없다.
  if (created.visibility === 'private') state.members.set(created.id, new Set([meId]))
  return viewOf(created, meId)
}

/**
 * 상한을 바꾼다. 취소가 아니라 또 하나의 변경이다 — 올려 둔 동안 발행된 것은
 * 이미 남의 지갑에 있다. 근거: docs/JOURNEY.md 여정 9
 */
export function findCapChangeByKey(key: string): CapChange | undefined {
  return state.capChanges.find((change) => change.idempotencyKey === key)
}

export function changeCap(
  meId: UserId,
  pointTypeId: PointTypeId,
  issueCap: Points,
  idempotencyKey: string,
): PointType {
  const existing = findCapChangeByKey(idempotencyKey)
  if (existing) return viewOf(requirePointType(existing.pointTypeId), meId)

  const pointType = requirePointType(pointTypeId)
  if (pointType.issuerId !== meId) throw new LedgerError('NOT_ISSUER')
  // 유통량이 상한을 넘은 상태가 되면 상한이 뜻을 잃는다.
  if (issueCap < pointType.totalIssued) throw new LedgerError('CAP_BELOW_ISSUED')

  const changed: SeedPoint = { ...pointType, issueCap }
  state.pointTypes.set(pointType.id, changed)
  state.capChanges.unshift({
    id: `cc_${state.capChanges.length + 1}_${idempotencyKey.slice(0, 8)}`,
    idempotencyKey,
    pointTypeId: pointType.id,
    byId: meId,
    previousCap: pointType.issueCap,
    issueCap,
    changedAt: new Date().toISOString(),
  })
  return viewOf(changed, meId)
}

interface SeedInvite {
  id: string
  pointTypeId: PointTypeId
  toId: UserId
  byId: UserId
  createdAt: string
}

function inviteViewOf(invite: SeedInvite, meId: UserId): Invite {
  return {
    id: invite.id,
    pointType: viewOf(state.pointTypes.get(invite.pointTypeId)!, meId),
    byId: invite.byId,
    byHandle: state.users.get(invite.byId)!.handle,
    createdAt: invite.createdAt,
  }
}

/** 내가 받은 초대. 남의 초대는 애초에 담기지 않는다 */
export function invitesFor(userId: UserId): Invite[] {
  return [...state.invites.values()]
    .filter((invite) => invite.toId === userId)
    .map((invite) => inviteViewOf(invite, userId))
}

/**
 * 초대한다. 은행장만 하고, 이미 초대된 사람을 다시 초대하면 같은 초대를 돌려준다.
 * 근거: docs/API.md 「회원 자격」
 */
export function invite(
  meId: UserId,
  pointTypeId: PointTypeId,
  toId: UserId,
  idempotencyKey: string,
): Invite {
  const replayed = state.invitedByKey.get(idempotencyScope(meId, idempotencyKey))
  if (replayed) return inviteViewOf(state.invites.get(replayed)!, meId)

  const pointType = requirePointType(pointTypeId)
  // 공개 은행에는 회원이 없으므로 초대할 것도 없다. 닿지 않는 은행은 없는 은행이다 —
  // 403 으로 답하면 회원이 아닌 사람에게 그 은행의 존재를 알려 준다.
  if (pointType.visibility === 'public' || !reachable(pointType, meId)) {
    throw new LedgerError('POINT_TYPE_NOT_FOUND')
  }
  if (pointType.issuerId !== meId) throw new LedgerError('NOT_ISSUER')
  requireRecipient(toId)

  const existing = [...state.invites.values()].find(
    (candidate) => candidate.pointTypeId === pointTypeId && candidate.toId === toId,
  )
  if (existing) {
    state.invitedByKey.set(idempotencyScope(meId, idempotencyKey), existing.id)
    return inviteViewOf(existing, meId)
  }

  const created: SeedInvite = {
    id: `iv_${state.invites.size + 1}_${idempotencyKey.slice(0, 8)}`,
    pointTypeId,
    toId,
    byId: meId,
    createdAt: new Date().toISOString(),
  }
  // 이미 회원이면 초대를 남기지 않는다. 수락할 것이 없는 줄이 초대함에 쌓인다.
  if (isMember(pointTypeId, toId)) return inviteViewOf(created, meId)

  state.invites.set(created.id, created)
  state.invitedByKey.set(idempotencyScope(meId, idempotencyKey), created.id)
  return inviteViewOf(created, meId)
}

/** 수락하면 초대가 사라지고 회원이 된다. 남의 초대는 없는 것과 같다 */
export function acceptInvite(meId: UserId, inviteId: string): PointType {
  const invite = state.invites.get(inviteId)
  // 남의 초대 id 로 물어도 없을 때와 같은 답이어야 한다.
  if (!invite || invite.toId !== meId) throw new LedgerError('POINT_TYPE_NOT_FOUND')

  const members = state.members.get(invite.pointTypeId) ?? new Set<UserId>()
  members.add(meId)
  state.members.set(invite.pointTypeId, members)
  state.invites.delete(inviteId)
  return viewOf(requirePointType(invite.pointTypeId), meId)
}

/**
 * 회원 목록은 셋으로 답한다 — 계약: docs/API.md 「회원 자격」.
 *
 * 비회원에게 `404` 가 아닌 이유는 감출 것이 남아 있지 않아서다. 공개 은행에
 * 빈 배열을 주지 않는 이유는 그것이 「지금 0명」으로 읽히기 때문이다.
 */
export function membersOf(pointTypeId: PointTypeId, meId: UserId): User[] {
  const pointType = state.pointTypes.get(pointTypeId)
  // 닿지 않는 은행은 없는 은행이다. 감출 것이 남아 있는 사람에게는 여전히 감춘다.
  if (!pointType || !reachable(pointType, meId)) throw new LedgerError('POINT_TYPE_NOT_FOUND')
  if (pointType.visibility === 'public') throw new LedgerError('NOT_A_PRIVATE_BANK')
  if (!isMember(pointTypeId, meId)) throw new LedgerError('NOT_MEMBER')

  return [...(state.members.get(pointTypeId) ?? [])]
    .map((id) => userById(id))
    .filter((user): user is User => user !== undefined)
}

/**
 * 나가기와 내보내기는 같은 일을 하고 누가 정했느냐만 다르다. 둘 다 **포인트를
 * 회수하지 않는다** — 잔액은 그대로 남고 쓸 수 없다. 계약: docs/API.md
 */
export function removeMember(meId: UserId, pointTypeId: PointTypeId, targetId: UserId): void {
  const pointType = state.pointTypes.get(pointTypeId)
  // 닿지 않는 은행은 없는 은행이다.
  if (!pointType || pointType.visibility === 'public' || !isMember(pointTypeId, meId)) {
    throw new LedgerError('POINT_TYPE_NOT_FOUND')
  }
  // 남을 내보내는 것은 은행장만 한다. 나가는 것은 누구나 자기에 대해 한다.
  if (targetId !== meId && pointType.issuerId !== meId) throw new LedgerError('NOT_ISSUER')
  // 발행할 사람이 없는 은행이 되고, 상한도 품목도 관리할 수 없어진다.
  if (targetId === pointType.issuerId) throw new LedgerError('ISSUER_CANNOT_LEAVE')

  state.members.get(pointTypeId)?.delete(targetId)
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
  // 나에게 닿지 않는 은행은 없는 은행이다. 그 은행이 존재한다고 알려 주지 않는다.
  if (!reachable(pointType, meId)) throw new LedgerError('POINT_TYPE_NOT_FOUND')
  // 닿는데 회원이 아니면 그 사실을 말한다. 「대상이 없어요」로 답하면 사용자가
  // 받는 사람 핸들을 다시 확인하기 시작한다 — 엉뚱한 곳을 고치게 만든다.
  if (!usable(pointType, meId)) throw new LedgerError('NOT_MEMBER')
  const recipient = requireRecipient(input.toId)
  // 비공개 은행에서 회원이 아닌 사람은 없는 사람과 구별되지 않아야 한다.
  if (!usable(pointType, recipient.id)) throw new LedgerError('RECIPIENT_NOT_FOUND')

  if (input.amount > balanceOf(pointType.id, meId)) {
    throw new LedgerError('INSUFFICIENT_BALANCE')
  }

  move(pointType.id, meId, -input.amount)
  move(pointType.id, recipient.id, input.amount)
  // 판단이 실제로 필요한 순간이 여기였다. 지나고 나면 판단은 끝난 것이다.
  state.spent.add(balanceKey(pointType.id, meId))
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

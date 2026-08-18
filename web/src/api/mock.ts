// Mock 원장. PointApi 를 메모리 위에서 구현한다.
//
// 동시성 충돌은 만들지 않는다 — 요청은 직렬 처리된다. 대신 지연과 실패는
// sim.ts 로 주입할 수 있다. 그것 없이는 헌법 10~12조를 검증할 수 없다.
//
// 나중에 Spring Boot 로 교체할 때 이 파일만 버리면 된다. 클라이언트는
// contract.ts 의 PointApi 에만 의존한다.

import type {
  Account,
  Ledger,
  Points,
  ProgressStep,
  Role,
  Transfer,
  TransferKind,
  User,
  UserId,
} from '../domain/types'
import { PROGRESS_STEPS } from '../domain/types'
import { cancelWindowFor } from '../domain/rules'
import {
  ApiError,
  type CreateIssueInput,
  type CreateTransferInput,
  type PointApi,
  type Unsubscribe,
} from './contract'
import { delay, drawFailure, getSim, simulatedLatency } from './sim'

const ME: UserId = 'u_minho'

function seedUsers(): User[] {
  return [
    { id: ME, name: '장민호', handle: '@minho', role: 'issuer' },
    { id: 'u_jisoo', name: '김지수', handle: '@jisoo', role: 'member' },
    { id: 'u_taeyun', name: '박태윤', handle: '@taeyun', role: 'member' },
    { id: 'u_seoyeon', name: '이서연', handle: '@seoyeon', role: 'member' },
    { id: 'u_junho', name: '최준호', handle: '@junho', role: 'member' },
    // 이름이 비슷한 사용자를 일부러 넣는다. 헌법 6조가 막으려는 실수가
    // 실제로 가능한 원장이어야 검증에 의미가 있다.
    { id: 'u_jisu', name: '김지수', handle: '@jisu', role: 'member' },
  ]
}

const SEED_BALANCES: Record<UserId, Points> = {
  u_minho: 3_240_000,
  u_jisoo: 812_000,
  u_taeyun: 1_450_000,
  u_seoyeon: 96_500,
  u_junho: 27_800,
  u_jisu: 340_000,
}

const SEED_LEDGER: Ledger = {
  totalIssued: 50_000_000,
  issueCap: 100_000_000,
}

/** 최근 이체 대상 순서를 만들기 위한 씨앗. 헌법 2조 — 흔한 행동이 커서 아래에 있어야 한다. */
const SEED_RECENT: UserId[] = ['u_jisoo', 'u_taeyun', 'u_junho', 'u_seoyeon']

interface State {
  users: Map<UserId, User>
  balances: Map<UserId, Points>
  transfers: Map<string, Transfer>
  /** 멱등성 키 → 이체 id */
  byKey: Map<string, string>
  /** 최신순 이체 id */
  order: string[]
  ledger: Ledger
  recent: UserId[]
}

function initialState(): State {
  const users = new Map<UserId, User>()
  for (const user of seedUsers()) users.set(user.id, user)
  return {
    users,
    balances: new Map(Object.entries(SEED_BALANCES)),
    transfers: new Map(),
    byKey: new Map(),
    order: [],
    ledger: { ...SEED_LEDGER },
    recent: [...SEED_RECENT],
  }
}

let state = initialState()

/** transferId → 예약된 타이머. 취소 시 전부 해제한다. */
const timers = new Map<string, ReturnType<typeof setTimeout>[]>()
/** transferId → 구독자 */
const watchers = new Map<string, Set<(transfer: Transfer) => void>>()

function notify(transferId: string): void {
  const transfer = state.transfers.get(transferId)
  if (!transfer) return
  for (const listener of watchers.get(transferId) ?? []) listener({ ...transfer })
}

function clearTimers(transferId: string): void {
  for (const handle of timers.get(transferId) ?? []) clearTimeout(handle)
  timers.delete(transferId)
}

function schedule(transferId: string, ms: number, fn: () => void): void {
  const handle = setTimeout(fn, ms)
  const list = timers.get(transferId) ?? []
  list.push(handle)
  timers.set(transferId, list)
}

function patch(transferId: string, changes: Partial<Transfer>): void {
  const current = state.transfers.get(transferId)
  if (!current) return
  state.transfers.set(transferId, { ...current, ...changes })
}

/**
 * pending 인 출금 예약분.
 *
 * 취소 창 동안에는 실제 출금이 일어나지 않지만(docs/API.md), 그렇다고 같은 돈을
 * 두 번 보낼 수 있어서는 안 된다. 그래서 잔액 검사는 예약분을 뺀 값으로 한다.
 */
function pendingOutgoing(userId: UserId): Points {
  let total = 0
  for (const transfer of state.transfers.values()) {
    if (transfer.status === 'pending' && transfer.fromId === userId) total += transfer.amount
  }
  return total
}

function available(userId: UserId): Points {
  return (state.balances.get(userId) ?? 0) - pendingOutgoing(userId)
}

/** 모든 단계가 끝나 확정한다. 잔액은 이 순간에만 움직인다 (헌법 11조). */
function settle(transferId: string): void {
  const transfer = state.transfers.get(transferId)
  if (!transfer || transfer.status !== 'pending') return

  if (transfer.kind === 'issue') {
    state.ledger = { ...state.ledger, totalIssued: state.ledger.totalIssued + transfer.amount }
  } else if (transfer.fromId) {
    state.balances.set(transfer.fromId, (state.balances.get(transfer.fromId) ?? 0) - transfer.amount)
  }
  state.balances.set(transfer.toId, (state.balances.get(transfer.toId) ?? 0) + transfer.amount)

  state.recent = [transfer.toId, ...state.recent.filter((id) => id !== transfer.toId)]

  patch(transferId, {
    status: 'confirmed',
    completedSteps: [...PROGRESS_STEPS],
    confirmedAt: new Date().toISOString(),
  })
  clearTimers(transferId)
  notify(transferId)
}

/**
 * 취소 창이 끝난 시점부터 단계를 순차로 진행한다.
 *
 * 단계를 건너뛰거나 미리 완료 표시하지 않는다 (헌법 11조).
 */
function startProcessing(transferId: string): void {
  const transfer = state.transfers.get(transferId)
  if (!transfer || transfer.status !== 'pending') return

  const { stepDelaysMs } = getSim()
  let elapsed = 0
  const done: ProgressStep[] = []

  for (const step of PROGRESS_STEPS) {
    elapsed += stepDelaysMs[step]
    const snapshot = [...done, step]
    done.push(step)
    schedule(transferId, elapsed, () => {
      if (state.transfers.get(transferId)?.status !== 'pending') return
      patch(transferId, { completedSteps: snapshot })
      notify(transferId)
      if (snapshot.length === PROGRESS_STEPS.length) settle(transferId)
    })
  }
}

async function roundTrip(): Promise<void> {
  await delay(simulatedLatency())
  const failure = drawFailure()
  if (failure === 'NETWORK') {
    throw new ApiError('NETWORK', '요청이 서버에 닿지 못했다')
  }
  if (failure === 'SERVER') {
    throw new ApiError('SERVER', '서버가 요청을 처리하지 못했다')
  }
  if (failure) {
    // forceFailure 로 도메인 실패를 강제한 경우. 검증 단계로 넘기지 않고 그대로 던진다.
    throw new ApiError(failure, `주입된 실패: ${failure}`)
  }
}

function shareOfTotal(balance: Points): number {
  return state.ledger.totalIssued === 0 ? 0 : balance / state.ledger.totalIssued
}

function create(kind: TransferKind, input: CreateTransferInput | CreateIssueInput): Transfer {
  const existingId = state.byKey.get(input.idempotencyKey)
  if (existingId) {
    // 멱등성: 같은 키로 재요청하면 새 이체를 만들지 않는다 (docs/API.md).
    return { ...state.transfers.get(existingId)! }
  }

  const recipient = state.users.get(input.toId)
  if (!recipient) throw new ApiError('RECIPIENT_NOT_FOUND', '받는 사람을 찾을 수 없다')

  if (kind === 'transfer') {
    if (input.amount > available(ME)) {
      throw new ApiError('INSUFFICIENT_BALANCE', '잔액이 부족하다')
    }
  } else {
    if (state.users.get(ME)?.role !== 'issuer') {
      throw new ApiError('SERVER', '발행 권한이 없다')
    }
    if (state.ledger.totalIssued + input.amount > state.ledger.issueCap) {
      throw new ApiError('CAP_EXCEEDED', '발행 상한을 넘는다')
    }
  }

  const now = Date.now()
  const cancelWindowMs = cancelWindowFor(kind)
  const id = `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`

  const transfer: Transfer = {
    id,
    idempotencyKey: input.idempotencyKey,
    kind,
    fromId: kind === 'issue' ? null : ME,
    toId: input.toId,
    amount: input.amount,
    memo: input.memo,
    status: 'pending',
    completedSteps: [],
    createdAt: new Date(now).toISOString(),
    cancelableUntil: new Date(now + cancelWindowMs).toISOString(),
  }

  state.transfers.set(id, transfer)
  state.byKey.set(input.idempotencyKey, id)
  state.order.unshift(id)

  // 취소 창 동안은 아무 처리도 하지 않는다. 창이 끝나면 실제 단계가 시작된다.
  schedule(id, cancelWindowMs, () => startProcessing(id))

  return { ...transfer }
}

export const mockApi: PointApi = {
  async me(): Promise<Account> {
    await roundTrip()
    const user = state.users.get(ME)!
    const balance = state.balances.get(ME) ?? 0
    return { user, balance, shareOfTotal: shareOfTotal(balance) }
  },

  async users(query?: string): Promise<User[]> {
    await roundTrip()
    const others = [...state.users.values()].filter((user) => user.id !== ME)
    if (!query?.trim()) {
      // 최근 이체 대상을 앞에 둔다 (헌법 2조).
      const rank = new Map(state.recent.map((id, index) => [id, index]))
      return others.sort(
        (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      )
    }
    const needle = query.trim().toLowerCase()
    return others.filter(
      (user) => user.name.includes(needle) || user.handle.toLowerCase().includes(needle),
    )
  },

  async recent(limit = 4): Promise<User[]> {
    await roundTrip()
    return state.recent
      .slice(0, limit)
      .map((id) => state.users.get(id))
      .filter((user): user is User => user !== undefined)
  },

  async ledger(): Promise<Ledger> {
    await roundTrip()
    return { ...state.ledger }
  },

  async createTransfer(input: CreateTransferInput): Promise<Transfer> {
    await roundTrip()
    return create('transfer', input)
  },

  async createIssue(input: CreateIssueInput): Promise<Transfer> {
    await roundTrip()
    return create('issue', input)
  },

  async cancel(transferId: string): Promise<Transfer> {
    await roundTrip()
    const transfer = state.transfers.get(transferId)
    if (!transfer) throw new ApiError('SERVER', '이체를 찾을 수 없다')
    if (transfer.status !== 'pending' || Date.now() >= Date.parse(transfer.cancelableUntil)) {
      throw new ApiError('NOT_CANCELLABLE', '취소 창이 지났다')
    }
    clearTimers(transferId)
    patch(transferId, { status: 'cancelled' })
    notify(transferId)
    return { ...state.transfers.get(transferId)! }
  },

  async get(transferId: string): Promise<Transfer> {
    await roundTrip()
    const transfer = state.transfers.get(transferId)
    if (!transfer) throw new ApiError('SERVER', '이체를 찾을 수 없다')
    return { ...transfer }
  },

  async history(limit = 20): Promise<Transfer[]> {
    await roundTrip()
    return state.order
      .slice(0, limit)
      .map((id) => ({ ...state.transfers.get(id)! }))
  },

  watch(transferId: string, onChange: (transfer: Transfer) => void): Unsubscribe {
    const set = watchers.get(transferId) ?? new Set()
    set.add(onChange)
    watchers.set(transferId, set)
    return () => {
      set.delete(onChange)
      if (set.size === 0) watchers.delete(transferId)
    }
  },
}

// ── 개발자 패널 전용. 계약(PointApi) 밖의 함수다. 실서버에는 대응물이 없다. ──

export function lookupUser(userId: UserId): User | undefined {
  return state.users.get(userId)
}

export function currentBalance(): Points {
  return state.balances.get(ME) ?? 0
}

export function currentLedger(): Ledger {
  return { ...state.ledger }
}

/** 역할 전환. 헌법 25조 — 역할은 화면이 아니라 상태다. */
export function setMyRole(role: Role): void {
  const user = state.users.get(ME)
  if (user) state.users.set(ME, { ...user, role })
}

export function resetLedger(): void {
  for (const transferId of timers.keys()) clearTimers(transferId)
  watchers.clear()
  state = initialState()
}

export const MY_ID = ME

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentBalance,
  currentLedger,
  MY_ID,
  mockApi,
  resetLedger,
  setMyRole,
} from './mock'
import { ApiError } from './contract'
import { resetSim, setSim } from './sim'
import { cancelWindowFor } from '../domain/rules'

/**
 * Mock 원장 시나리오.
 *
 * 여기서 지키려는 것은 `docs/JOURNEY.md` 여정 5 의 한 문장이다 —
 * **취소할 수 있다고 말하는 동안 서버는 아무것도 처리하지 않는다.**
 * 잔액이 언제 움직이는지가 이 파일의 주된 관심사다.
 */

/**
 * 가짜 타이머 위에서 요청 하나를 왕복시킨다.
 *
 * 타이머를 밀기 **전에** 결과 핸들러를 붙인다. 나중에 붙이면 그 사이에 일어난
 * 거절이 unhandled rejection 이 되어, 실패를 검증하는 테스트가 통과하면서도
 * 러너를 오염시킨다.
 */
async function go<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true, value }) as const,
    (error: unknown) => ({ ok: false, error }) as const,
  )
  await vi.advanceTimersByTimeAsync(1)
  const result = await settled
  if (!result.ok) throw result.error
  return result.value
}

const CANCEL_WINDOW = cancelWindowFor('transfer')
const STEP_TOTAL = 300 + 500 + 900 + 400

let keySeq = 0
const nextKey = () => `k_${++keySeq}`

beforeEach(() => {
  vi.useFakeTimers()
  resetLedger()
  resetSim()
  setSim({ latencyMs: 0, jitterMs: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('조회', () => {
  it('me 는 잔액과 전체 중 비중을 준다', async () => {
    const account = await go(mockApi.me())
    expect(account.user.id).toBe(MY_ID)
    expect(account.balance).toBe(3_240_000)
    expect(account.shareOfTotal).toBeCloseTo(3_240_000 / 50_000_000)
  })

  it('users 는 최근 보낸 사람을 앞에 둔다', async () => {
    const users = await go(mockApi.users())
    expect(users.map((u) => u.id).slice(0, 4)).toEqual([
      'u_jisoo',
      'u_taeyun',
      'u_junho',
      'u_seoyeon',
    ])
    expect(users.some((u) => u.id === MY_ID)).toBe(false)
  })

  it('이름 검색은 동명이인을 모두 준다 — 화면이 구별을 책임져야 한다', async () => {
    const found = await go(mockApi.users('김지수'))
    expect(found).toHaveLength(2)
    expect(found.map((u) => u.handle).sort()).toEqual(['@jisoo', '@jisu'])
  })

  it('핸들로도 찾는다 — 동명이인을 가르는 유일한 문자열이다', async () => {
    const found = await go(mockApi.users('@jisu'))
    expect(found.map((u) => u.id)).toEqual(['u_jisu'])
  })
})

describe('취소 창 — 이 구간에는 아무 처리도 일어나지 않는다', () => {
  it('생성 직후는 pending 이고 단계가 하나도 없다', async () => {
    const transfer = await go(
      mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 30_000 }),
    )
    expect(transfer.status).toBe('pending')
    expect(transfer.completedSteps).toEqual([])
    expect(Date.parse(transfer.cancelableUntil) - Date.parse(transfer.createdAt)).toBe(CANCEL_WINDOW)
  })

  it('취소 창 내내 잔액이 움직이지 않는다', async () => {
    const before = currentBalance()
    await go(mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 30_000 }))
    await vi.advanceTimersByTimeAsync(CANCEL_WINDOW - 1)
    expect(currentBalance()).toBe(before)
  })

  it('취소 창 안에서는 취소된다', async () => {
    const created = await go(
      mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 30_000 }),
    )
    await vi.advanceTimersByTimeAsync(CANCEL_WINDOW - 100)
    const cancelled = await go(mockApi.cancel(created.id))
    expect(cancelled.status).toBe('cancelled')

    // 취소한 이체가 나중에 되살아나지 않는다
    await vi.advanceTimersByTimeAsync(CANCEL_WINDOW + STEP_TOTAL)
    expect((await go(mockApi.get(created.id))).status).toBe('cancelled')
    expect(currentBalance()).toBe(3_240_000)
  })

  it('취소 창이 지나면 취소할 수 없다', async () => {
    const created = await go(
      mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 30_000 }),
    )
    await vi.advanceTimersByTimeAsync(CANCEL_WINDOW + 1)
    await expect(go(mockApi.cancel(created.id))).rejects.toMatchObject({ code: 'NOT_CANCELLABLE' })
  })

  it('취소 창 중에도 같은 돈을 두 번 예약할 수 없다', async () => {
    await go(mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 3_000_000 }))
    await expect(
      go(mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_taeyun', amount: 3_000_000 })),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })
})

describe('처리 — 단계를 건너뛰거나 앞질러 표시하지 않는다', () => {
  it('단계가 순서대로 하나씩 채워진다', async () => {
    const created = await go(
      mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 30_000 }),
    )
    const seen: string[][] = []
    mockApi.watch(created.id, (t) => seen.push([...t.completedSteps]))

    await vi.advanceTimersByTimeAsync(CANCEL_WINDOW + STEP_TOTAL)

    expect(seen).toEqual([
      ['withdraw'],
      ['withdraw', 'request'],
      ['withdraw', 'request', 'verify'],
      ['withdraw', 'request', 'verify', 'deposit'],
      ['withdraw', 'request', 'verify', 'deposit'],
    ])
  })

  it('모든 단계가 끝나야 잔액이 움직인다', async () => {
    const created = await go(
      mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 30_000 }),
    )
    // 요청 왕복에도 시간이 흐르므로, 경과 시간이 아니라 서버가 말한 절대 시각을 기준으로 센다.
    const settleAt = Date.parse(created.cancelableUntil) + STEP_TOTAL

    await vi.advanceTimersByTimeAsync(settleAt - Date.now() - 1)
    expect(currentBalance()).toBe(3_240_000)

    await vi.advanceTimersByTimeAsync(2)
    expect(currentBalance()).toBe(3_240_000 - 30_000)
  })

  it('확정되면 확정 시각이 찍히고 받는 사람이 최근 목록 맨 앞으로 온다', async () => {
    const created = await go(
      mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_seoyeon', amount: 1_000 }),
    )
    await vi.advanceTimersByTimeAsync(CANCEL_WINDOW + STEP_TOTAL)

    const settled = await go(mockApi.get(created.id))
    expect(settled.status).toBe('confirmed')
    expect(settled.confirmedAt).toBeTruthy()

    const users = await go(mockApi.users())
    expect(users[0].id).toBe('u_seoyeon')
  })
})

describe('멱등성 — 이중 이체를 막는 것은 이 키뿐이다', () => {
  it('같은 키로 두 번 요청하면 이체가 하나만 생긴다', async () => {
    const key = nextKey()
    const first = await go(mockApi.createTransfer({ idempotencyKey: key, toId: 'u_jisoo', amount: 30_000 }))
    const second = await go(mockApi.createTransfer({ idempotencyKey: key, toId: 'u_jisoo', amount: 30_000 }))
    expect(second.id).toBe(first.id)
    expect(await go(mockApi.history())).toHaveLength(1)
  })

  it('재요청은 잔액 검사를 다시 거치지 않는다 — 이미 성립한 이체다', async () => {
    const key = nextKey()
    await go(mockApi.createTransfer({ idempotencyKey: key, toId: 'u_jisoo', amount: 3_000_000 }))
    const replay = await go(
      mockApi.createTransfer({ idempotencyKey: key, toId: 'u_jisoo', amount: 3_000_000 }),
    )
    expect(replay.status).toBe('pending')
  })
})

describe('거절', () => {
  it('잔액을 넘으면 만들지 않는다', async () => {
    await expect(
      go(mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 9_999_999 })),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('없는 사람에게는 보내지 않는다', async () => {
    await expect(
      go(mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_nobody', amount: 1 })),
    ).rejects.toMatchObject({ code: 'RECIPIENT_NOT_FOUND' })
  })

  it('주입한 실패는 한 번만 쓰이고 소모된다', async () => {
    setSim({ forceFailure: 'NETWORK' })
    await expect(go(mockApi.me())).rejects.toMatchObject({ code: 'NETWORK', outcomeUnknown: true })
    await expect(go(mockApi.me())).resolves.toBeTruthy()
  })
})

describe('발행 — 이체와 같은 기계, 다른 규칙', () => {
  it('발행은 무에서 만든다. 보내는 사람이 없다', async () => {
    const issued = await go(
      mockApi.createIssue({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 1_000_000 }),
    )
    expect(issued.fromId).toBeNull()
    expect(Date.parse(issued.cancelableUntil) - Date.parse(issued.createdAt)).toBe(cancelWindowFor('issue'))
  })

  it('확정되면 내 잔액이 아니라 총 유통량이 늘어난다', async () => {
    await go(mockApi.createIssue({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 1_000_000 }))
    await vi.advanceTimersByTimeAsync(cancelWindowFor('issue') + STEP_TOTAL)
    expect(currentLedger().totalIssued).toBe(51_000_000)
    expect(currentBalance()).toBe(3_240_000)
  })

  it('상한을 넘으면 발행하지 않는다', async () => {
    await expect(
      go(mockApi.createIssue({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 60_000_000 })),
    ).rejects.toMatchObject({ code: 'CAP_EXCEEDED' })
  })

  it('발행자가 아니면 발행할 수 없다', async () => {
    setMyRole('member')
    await expect(
      go(mockApi.createIssue({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 1 })),
    ).rejects.toBeInstanceOf(ApiError)
  })
})

describe('내역', () => {
  it('최신순으로 준다', async () => {
    const a = await go(mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 1_000 }))
    const b = await go(mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_taeyun', amount: 2_000 }))
    expect((await go(mockApi.history())).map((t) => t.id)).toEqual([b.id, a.id])
  })

  it('구독을 해제하면 더 이상 알리지 않는다', async () => {
    const created = await go(
      mockApi.createTransfer({ idempotencyKey: nextKey(), toId: 'u_jisoo', amount: 1_000 }),
    )
    const seen: string[] = []
    const stop = mockApi.watch(created.id, (t) => seen.push(t.status))
    stop()
    await vi.advanceTimersByTimeAsync(CANCEL_WINDOW + STEP_TOTAL)
    expect(seen).toEqual([])
  })
})

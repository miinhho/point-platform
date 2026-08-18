import { describe, expect, it } from 'vitest'
import {
  currentAmount,
  flowReducer,
  initialFlow,
  isTerminal,
  resolveBack,
  type FlowAction,
  type FlowState,
} from './transferFlow'
import type { Transfer, User } from '../domain/types'

const JISOO: User = { id: 'u_jisoo', name: '김지수', handle: '@jisoo', role: 'member' }
const JISU: User = { id: 'u_jisu', name: '김지수', handle: '@jisu', role: 'member' }

function run(state: FlowState, ...actions: FlowAction[]): FlowState {
  return actions.reduce(flowReducer, state)
}

function transfer(over: Partial<Transfer> = {}): Transfer {
  return {
    id: 't_1',
    idempotencyKey: 'k_1',
    kind: 'transfer',
    fromId: 'u_minho',
    toId: JISOO.id,
    amount: 30_000,
    status: 'pending',
    completedSteps: [],
    createdAt: '2026-08-18T00:00:00Z',
    cancelableUntil: '2026-08-18T00:00:03Z',
    ...over,
  }
}

/** 홈 → 확정 직전까지. 대부분의 테스트가 여기서 출발한다. */
function atConfirm(kind: 'transfer' | 'issue' = 'transfer'): FlowState {
  return run(
    initialFlow,
    { type: 'quickPick', kind, to: JISOO },
    { type: 'digit', digit: '3' },
    ...(['0', '0', '0', '0'] as const).map((d) => ({ type: 'digit' as const, digit: d })),
    { type: 'toConfirm' },
  )
}

describe('진입', () => {
  it('start 는 대상 선택으로 간다', () => {
    expect(run(initialFlow, { type: 'start', kind: 'transfer' })).toEqual({
      step: 'pickRecipient',
      kind: 'transfer',
      query: '',
    })
  })

  it('발행도 같은 상태 기계를 쓴다 — kind 만 다르다', () => {
    const state = run(initialFlow, { type: 'start', kind: 'issue' })
    expect(state).toMatchObject({ step: 'pickRecipient', kind: 'issue' })
  })

  it('quickPick 은 홈에서만 유효하다', () => {
    const picker = run(initialFlow, { type: 'start', kind: 'transfer' })
    expect(run(picker, { type: 'quickPick', kind: 'transfer', to: JISOO })).toBe(picker)
  })

  it('quickPick 은 대상 선택을 건너뛰고 금액으로 간다', () => {
    expect(run(initialFlow, { type: 'quickPick', kind: 'transfer', to: JISOO })).toEqual({
      step: 'enterAmount',
      kind: 'transfer',
      to: JISOO,
      raw: '',
      origin: 'home',
    })
  })

  it('pick 은 출처를 picker 로 남긴다', () => {
    const state = run(
      initialFlow,
      { type: 'start', kind: 'transfer' },
      { type: 'pick', to: JISU },
    )
    expect(state).toMatchObject({ step: 'enterAmount', to: JISU, origin: 'picker' })
  })

  it('setQuery 는 대상 선택에서만 동작한다', () => {
    const picker = run(initialFlow, { type: 'start', kind: 'transfer' }, { type: 'setQuery', query: '김' })
    expect(picker).toMatchObject({ query: '김' })
    expect(run(initialFlow, { type: 'setQuery', query: '김' })).toBe(initialFlow)
  })
})

describe('금액 입력', () => {
  const start = run(initialFlow, { type: 'quickPick', kind: 'transfer', to: JISOO })

  it('앞자리 0 을 막는다 — "007" 은 한글 표기를 흔든다', () => {
    expect(run(start, { type: 'digit', digit: '0' })).toBe(start)
  })

  it('자릿수 상한을 넘는 숫자는 무시한다', () => {
    const max = run(start, ...Array.from({ length: 13 }, () => ({ type: 'digit' as const, digit: '9' })))
    expect(run(max, { type: 'digit', digit: '9' })).toBe(max)
  })

  it('backspace 는 한 글자, clearAmount 는 전부 지운다', () => {
    const typed = run(start, { type: 'digit', digit: '1' }, { type: 'digit', digit: '2' })
    expect(currentAmount(run(typed, { type: 'backspace' }))).toBe(1)
    expect(currentAmount(run(typed, { type: 'clearAmount' }))).toBe(0)
  })

  it('많이 친 뒤 전체삭제 한 번이면 처음으로 돌아간다', () => {
    const long = run(start, ...Array.from({ length: 13 }, () => ({ type: 'digit' as const, digit: '9' })))
    expect(currentAmount(run(long, { type: 'clearAmount' }))).toBe(0)
  })

  it('금액이 0 이면 확정으로 넘어가지 않는다', () => {
    expect(run(start, { type: 'toConfirm' })).toBe(start)
  })
})

describe('확정', () => {
  it('확정 진입 시 멱등성 키가 생긴다', () => {
    const state = atConfirm()
    expect(state.step).toBe('confirm')
    if (state.step !== 'confirm') return
    expect(state.draft.idempotencyKey).toMatch(/[0-9a-f-]{16,}/)
    expect(state.draft.amount).toBe(30_000)
  })

  it('금액을 고치러 돌아갔다 오면 다른 키다 — 다른 금액은 다른 이체다', () => {
    const first = atConfirm()
    if (first.step !== 'confirm') throw new Error('confirm 이어야 한다')
    const second = run(first, { type: 'editAmount' }, { type: 'digit', digit: '0' }, { type: 'toConfirm' })
    if (second.step !== 'confirm') throw new Error('confirm 이어야 한다')
    expect(second.draft.idempotencyKey).not.toBe(first.draft.idempotencyKey)
    expect(second.draft.amount).toBe(300_000)
  })

  it('editAmount 는 출처를 유지한다', () => {
    const state = run(atConfirm(), { type: 'editAmount' })
    expect(state).toMatchObject({ step: 'enterAmount', origin: 'home', raw: '30000' })
  })
})

describe('전송 중 — 서버가 알려준 것만 반영한다', () => {
  const sending = run(atConfirm(), { type: 'submitted', transfer: transfer() })

  it('submitted 는 confirm 에서만 유효하다', () => {
    expect(run(initialFlow, { type: 'submitted', transfer: transfer() })).toBe(initialFlow)
  })

  it('pending 갱신은 화면을 바꾸지 않고 단계만 채운다', () => {
    const next = run(sending, {
      type: 'transferChanged',
      transfer: transfer({ completedSteps: ['withdraw'] }),
    })
    expect(next.step).toBe('sending')
    if (next.step !== 'sending') return
    expect(next.transfer.completedSteps).toEqual(['withdraw'])
  })

  it('confirmed 를 받아야 완료로 간다', () => {
    const next = run(sending, {
      type: 'transferChanged',
      transfer: transfer({ status: 'confirmed', confirmedAt: '2026-08-18T00:00:05Z' }),
    })
    expect(next.step).toBe('done')
  })

  it('cancelled 는 홈으로 돌아간다', () => {
    expect(run(sending, { type: 'transferChanged', transfer: transfer({ status: 'cancelled' }) })).toEqual({
      step: 'home',
    })
  })

  it('failed 는 실패 화면으로 가고 서버 사유를 싣는다', () => {
    const next = run(sending, {
      type: 'transferChanged',
      transfer: transfer({ status: 'failed', failure: { code: 'INSUFFICIENT_BALANCE', message: '잔액 부족' } }),
    })
    expect(next).toMatchObject({ step: 'failed', failure: { code: 'INSUFFICIENT_BALANCE' } })
  })

  it('사유 없는 failed 도 화면이 비지 않는다', () => {
    const next = run(sending, { type: 'transferChanged', transfer: transfer({ status: 'failed' }) })
    expect(next).toMatchObject({ step: 'failed', failure: { code: 'SERVER' } })
  })
})

describe('실패와 재시도', () => {
  const failed = run(atConfirm(), {
    type: 'failed',
    failure: { code: 'NETWORK', message: '연결 끊김' },
  })

  it('실패해도 입력을 버리지 않는다', () => {
    expect(failed).toMatchObject({ step: 'failed', draft: { amount: 30_000, to: JISOO } })
  })

  it('재시도는 같은 멱등성 키로 돌아간다 — 이중 이체를 막는 것은 이 키뿐이다', () => {
    if (failed.step !== 'failed') throw new Error('failed 여야 한다')
    const retried = run(failed, { type: 'retry' })
    if (retried.step !== 'confirm') throw new Error('confirm 이어야 한다')
    expect(retried.draft.idempotencyKey).toBe(failed.draft.idempotencyKey)
  })

  it('실패 화면에서 금액을 고치면 키를 버린다', () => {
    const edited = run(failed, { type: 'editAmount' })
    expect(edited.step).toBe('enterAmount')
  })

  it('failed 액션은 confirm/sending 에서만 유효하다', () => {
    expect(run(initialFlow, { type: 'failed', failure: { code: 'NETWORK', message: '' } })).toBe(initialFlow)
  })
})

describe('시스템 back — 순간마다 의미가 다르다', () => {
  it('홈에서는 소비하지 않는다. 셸이 앱을 닫는다', () => {
    expect(resolveBack({ step: 'home' })).toEqual({ kind: 'exit' })
  })

  it('대상 선택에서는 홈으로', () => {
    expect(resolveBack(run(initialFlow, { type: 'start', kind: 'transfer' }))).toEqual({
      kind: 'action',
      action: { type: 'toHome' },
    })
  })

  it('금액 화면의 back 은 지나온 길을 따른다 — 홈에서 왔으면 홈으로', () => {
    const fromHome = run(initialFlow, { type: 'quickPick', kind: 'transfer', to: JISOO })
    expect(resolveBack(fromHome)).toEqual({ kind: 'action', action: { type: 'toHome' } })
  })

  it('대상 선택을 거쳐 왔으면 그 화면으로', () => {
    const fromPicker = run(initialFlow, { type: 'start', kind: 'issue' }, { type: 'pick', to: JISU })
    expect(resolveBack(fromPicker)).toEqual({
      kind: 'action',
      action: { type: 'start', kind: 'issue' },
    })
  })

  it('확정 화면의 back 은 금액 수정이다', () => {
    expect(resolveBack(atConfirm())).toEqual({ kind: 'action', action: { type: 'editAmount' } })
  })

  it('전송 중에는 소비하되 아무것도 하지 않는다 — 취소 창이든 처리 중이든', () => {
    const inCancelWindow = run(atConfirm(), { type: 'submitted', transfer: transfer() })
    const processing = run(inCancelWindow, {
      type: 'transferChanged',
      transfer: transfer({ completedSteps: ['withdraw', 'request'] }),
    })
    expect(resolveBack(inCancelWindow)).toEqual({ kind: 'ignore' })
    expect(resolveBack(processing)).toEqual({ kind: 'ignore' })
  })

  it('완료와 실패에서는 홈으로', () => {
    const done = run(run(atConfirm(), { type: 'submitted', transfer: transfer() }), {
      type: 'transferChanged',
      transfer: transfer({ status: 'confirmed' }),
    })
    expect(resolveBack(done)).toEqual({ kind: 'action', action: { type: 'toHome' } })
  })
})

describe('보조', () => {
  it('currentAmount 는 어느 단계에서든 같은 금액을 준다', () => {
    const confirm = atConfirm()
    expect(currentAmount(confirm)).toBe(30_000)
    expect(currentAmount(run(confirm, { type: 'submitted', transfer: transfer() }))).toBe(30_000)
    expect(currentAmount(initialFlow)).toBe(0)
  })

  it('isTerminal 은 완료와 실패만 참', () => {
    expect(isTerminal(initialFlow)).toBe(false)
    expect(isTerminal(atConfirm())).toBe(false)
    expect(isTerminal({ ...atConfirm(), step: 'done' } as FlowState)).toBe(true)
  })
})

describe('내역 — 같은 상태 기계 안에 둔다', () => {
  const transfer: Transfer = {
    id: 't_9',
    idempotencyKey: 'k_9',
    kind: 'transfer',
    fromId: 'u_minho',
    toId: JISOO.id,
    amount: 30_000,
    status: 'confirmed',
    completedSteps: ['withdraw', 'request', 'verify', 'deposit'],
    createdAt: '2026-08-18T00:00:00Z',
    cancelableUntil: '2026-08-18T00:00:03Z',
    confirmedAt: '2026-08-18T00:00:05Z',
  }

  it('홈에서만 연다 — 송금 도중에 새는 경로를 만들지 않는다', () => {
    expect(run(initialFlow, { type: 'openHistory' })).toEqual({ step: 'history' })

    const confirm = atConfirm()
    expect(run(confirm, { type: 'openHistory' })).toBe(confirm)

    const sending = run(confirm, { type: 'submitted', transfer })
    expect(run(sending, { type: 'openHistory' })).toBe(sending)
  })

  it('상세는 목록에서만 연다', () => {
    const history = run(initialFlow, { type: 'openHistory' })
    expect(run(history, { type: 'openHistoryDetail', transfer })).toEqual({
      step: 'historyDetail',
      transfer,
    })
    expect(run(initialFlow, { type: 'openHistoryDetail', transfer })).toBe(initialFlow)
  })

  it('back 은 지나온 길을 되짚는다', () => {
    expect(resolveBack({ step: 'history' })).toEqual({
      kind: 'action',
      action: { type: 'toHome' },
    })
    expect(resolveBack({ step: 'historyDetail', transfer })).toEqual({
      kind: 'action',
      action: { type: 'openHistory' },
    })
  })
})

/**
 * 리졸버와 리듀서의 조합.
 *
 * `resolveBack` 이 옳은 액션을 돌려주는 것과, 그 액션이 실제로 상태를 바꾸는 것은
 * 다른 문제다. 둘을 따로 테스트하면 그 사이의 구멍이 보이지 않는다 —
 * 실제로 내역 상세에서 back 이 아무것도 하지 않는 버그를 이 테스트가 없어서 놓쳤다.
 */
describe('back 이 실제로 상태를 바꾸는가', () => {
  const transfer: Transfer = {
    id: 't_b',
    idempotencyKey: 'k_b',
    kind: 'transfer',
    fromId: 'u_minho',
    toId: JISOO.id,
    amount: 1_000,
    status: 'confirmed',
    completedSteps: [],
    createdAt: '2026-08-18T00:00:00Z',
    cancelableUntil: '2026-08-18T00:00:03Z',
  }

  const states: FlowState[] = [
    { step: 'home' },
    { step: 'history' },
    { step: 'historyDetail', transfer },
    { step: 'pickRecipient', kind: 'transfer', query: '' },
    run(initialFlow, { type: 'quickPick', kind: 'transfer', to: JISOO }),
    atConfirm(),
    run(atConfirm(), { type: 'submitted', transfer }),
    run(atConfirm(), { type: 'failed', failure: { code: 'NETWORK', message: '' } }),
  ]

  it('모든 상태에서 back 이 소비되면 상태가 실제로 달라진다', () => {
    for (const state of states) {
      const resolution = resolveBack(state)
      if (resolution.kind !== 'action') continue
      const next = flowReducer(state, resolution.action)
      expect(next, `${state.step} 에서 back 이 아무것도 하지 않았다`).not.toBe(state)
      expect(next.step, `${state.step} 에서 back 이 같은 화면에 머물렀다`).not.toBe(state.step)
    }
  })

  it('모든 상태가 back 해석을 가진다 — 정의되지 않은 화면을 남기지 않는다', () => {
    for (const state of states) {
      expect(['action', 'ignore', 'exit']).toContain(resolveBack(state).kind)
    }
  })
})

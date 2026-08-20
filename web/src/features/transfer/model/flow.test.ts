import { describe, expect, it } from 'vitest'
import type { PointType, User } from '@/shared/contract'
import {
  amountOf,
  appendDigit,
  backToAmount,
  clearAmount,
  editAmount,
  fail,
  pickRecipient,
  repick,
  seal,
  startIssue,
  startTransfer,
  stepBack,
  succeed,
  type FlowState,
} from './flow'

const ON: PointType = {
  id: 'pt_on',
  name: '온포인트',
  emoji: '🌊',
  description: null,
  issuerId: 'u_onmart',
  issuerName: '온마트',
  issuerHandle: '@onmart',
  createdAt: '2024-01-01T00:00:00.000Z',
  visibility: 'public',
  memberCount: null,
  nameIsShared: false,
  accent: 'blue',
  totalIssued: 50_000_000,
  issueCap: 100_000_000,
  canIssue: false,
  issuableHeadroom: 50_000_000,
}
const JISOO: User = { id: 'u_jisoo', name: '김지수', handle: '@jisoo', nameIsShared: true }
const ME: User = { id: 'u_minho', name: '장민호', handle: '@minho', nameIsShared: false }

const NETWORK = { code: 'NETWORK', outcome: 'unknown', message: '' } as const
const key = () => 'k_1'

function type(state: FlowState, digits: string): FlowState {
  let next = state
  for (const digit of digits) next = editAmount(next, (draft) => appendDigit(draft, digit))
  return next
}

/** 확정까지 간 흐름 */
function atConfirm(to: User = JISOO): FlowState {
  return seal(type(startTransfer(ON, to), '30000'), key)
}

describe('흐름은 단계와 값을 함께 갖는다', () => {
  it('대상이 정해져 있으면 금액부터', () => {
    const state = startTransfer(ON, JISOO)
    expect(state.current.step).toBe('enterAmount')
    expect(state.current.draft.to).toEqual(JISOO)
  })

  it('대상이 없으면 대상 선택부터', () => {
    const state = startTransfer(ON)
    expect(state.current.step).toBe('pickRecipient')
    expect(state.current.draft.to).toBeNull()
  })

  it('발행에는 대상 선택이 없다 — 대상이 나 자신이다', () => {
    const state = startIssue(ON, ME)
    expect(state.current.step).toBe('enterAmount')
    expect(state.current.draft.to).toEqual(ME)
    expect(state.current.draft.kind).toBe('issue')
  })

  it('대상 → 금액 → 확정', () => {
    const state = seal(type(pickRecipient(startTransfer(ON), JISOO), '30000'), key)
    expect(state.current.step).toBe('confirm')
    expect(amountOf(state.current.draft)).toBe(30_000)
    expect(state.current.draft.idempotencyKey).toBe('k_1')
  })

  /*
   * 타입이 이미 막는다 — 확정 단계의 초안에는 대상과 키가 반드시 있다. 이 테스트는
   * 그 불변식이 런타임에서도 지켜지는지를 본다.
   */
  it('대상을 고르기 전에는 확정으로 가지 않는다', () => {
    const state = seal(startTransfer(ON), key)
    expect(state.current.step).toBe('pickRecipient')
  })

  it('금액을 지워도 흐름은 그 자리다', () => {
    const state = editAmount(type(startTransfer(ON, JISOO), '300'), clearAmount)
    expect(state.current.step).toBe('enterAmount')
    expect(amountOf(state.current.draft)).toBe(0)
  })
})

describe('실패', () => {
  it('실패해도 초안을 버리지 않는다 — 재시도가 같은 키를 써야 한다', () => {
    const state = fail(atConfirm(), NETWORK)
    expect(state.current.step).toBe('failure')
    expect(state.current.draft.to).toEqual(JISOO)
    expect(state.current.draft.idempotencyKey).toBe('k_1')
    expect(amountOf(state.current.draft)).toBe(30_000)
  })

  // 결과를 모를 때 여러 번 누르는 것이 정상이다. 그때마다 길이 자라면 안 된다.
  it('실패를 반복해도 길이 자라지 않는다', () => {
    let state = fail(atConfirm(), NETWORK)
    const depth = state.past.length
    for (let i = 0; i < 3; i++) state = fail(state, NETWORK)
    expect(state.past.length).toBe(depth)
  })

  it('마지막 실패가 남는다', () => {
    const state = fail(fail(atConfirm(), NETWORK), {
      code: 'INSUFFICIENT_BALANCE',
      outcome: 'none',
      message: '',
    })
    expect(state.current.step === 'failure' && state.current.failure.code).toBe(
      'INSUFFICIENT_BALANCE',
    )
  })

  it('금액을 고치면 키를 버린다 — 다른 금액은 다른 이체다', () => {
    const back = backToAmount(fail(atConfirm(), NETWORK))
    expect(back.current.step).toBe('enterAmount')
    const edited = editAmount(back, (draft) => appendDigit(draft, '0'))
    expect(edited.current.draft.idempotencyKey).toBeNull()
    expect(amountOf(edited.current.draft)).toBe(300_000)
  })

  it('받는 사람을 다시 고르는 길은 대상 선택을 거쳐 왔을 때만 있다', () => {
    const viaPicker = fail(seal(type(pickRecipient(startTransfer(ON), JISOO), '3'), key), NETWORK)
    expect(repick(viaPicker).current.step).toBe('pickRecipient')

    const straight = fail(atConfirm(), NETWORK)
    expect(repick(straight)).toBe(straight)
  })
})

describe('뒤로 가기는 지나온 길을 따른다', () => {
  it('대상 선택을 거쳐 왔으면 거기로 돌아간다', () => {
    const state = type(pickRecipient(startTransfer(ON), JISOO), '3')
    expect(stepBack(state)?.current.step).toBe('pickRecipient')
  })

  it('바로 금액으로 왔으면 흐름이 끝난다 — 기억할 필드가 필요 없다', () => {
    expect(stepBack(startTransfer(ON, JISOO))).toBeNull()
  })

  it('대상 선택에서 뒤로 가면 흐름이 끝난다', () => {
    expect(stepBack(startTransfer(ON))).toBeNull()
  })

  /*
   * 확정된 이체를 다시 편집하는 화면으로 갈 수 없고, 실패에서도 재시도는 명시적
   * 행동이어야 한다. 근거: docs/JOURNEY.md 여정 6
   */
  it('완료·실패에서 back 은 흐름을 벗어난다 — 한 칸 뒤로가 아니다', () => {
    const done = succeed(atConfirm(), {
      id: 't_1',
      idempotencyKey: 'k_1',
      pointTypeId: 'pt_on',
      fromId: ME.id,
      toId: JISOO.id,
      amount: 30_000,
      counterparty: { name: JISOO.name, handle: JISOO.handle, nameIsShared: true },
      createdAt: '2026-08-20T00:00:00Z',
      confirmedAt: '2026-08-20T00:00:00Z',
    })
    expect(stepBack(done)).toBeNull()
    expect(stepBack(fail(atConfirm(), NETWORK))).toBeNull()
  })
})

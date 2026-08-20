import { describe, expect, it } from 'vitest'
import { createStore } from 'jotai'
import { currentScreenAtom, navAtom } from '@/app/atoms'
import {
  draftAtom,
  editDraftAtom,
  editAmountAtom,
  endFlowAtom,
  failAtom,
  failureAtom,
  pickRecipientAtom,
  startTransferAtom,
  toConfirmAtom,
} from './atoms'
import { amountOf, appendDigit, clearAmount } from './draft'
import type { PointType, User } from '@/shared/contract'

const ON: PointType = {
  id: 'pt_on',
  name: '온포인트',
  emoji: '🌊',
  description: '',
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

const at = (store: ReturnType<typeof createStore>) => store.get(currentScreenAtom)?.name ?? 'root'

function typeAmount(store: ReturnType<typeof createStore>, digits: string) {
  for (const digit of digits) store.set(editDraftAtom, (draft) => appendDigit(draft, digit))
}

describe('플로우', () => {
  it('대상이 정해져 있으면 금액 화면으로 직행한다', () => {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON, to: JISOO })
    expect(at(store)).toBe('enterAmount')
    expect(store.get(draftAtom)?.to).toEqual(JISOO)
  })

  it('대상이 없으면 대상 선택부터', () => {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON })
    expect(at(store)).toBe('pickRecipient')
    expect(store.get(draftAtom)?.to).toBeNull()
  })

  it('대상 → 금액 → 확정', () => {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON })
    store.set(pickRecipientAtom, JISOO)
    typeAmount(store, '30000')
    store.set(toConfirmAtom)
    expect(at(store)).toBe('confirm')
    expect(amountOf(store.get(draftAtom)!)).toBe(30_000)
    expect(store.get(draftAtom)?.idempotencyKey).toBeTruthy()
  })

  it('대상이 없으면 확정으로 넘어가지 않는다', () => {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON })
    typeAmount(store, '30000')
    store.set(toConfirmAtom)
    expect(at(store)).toBe('pickRecipient')
  })

  it('플로우 밖에서 키를 눌러도 아무 일도 없다', () => {
    const store = createStore()
    store.set(editDraftAtom, (draft) => appendDigit(draft, '3'))
    store.set(editDraftAtom, clearAmount)
    expect(store.get(draftAtom)).toBeNull()
  })
})

describe('실패', () => {
  function atFailure() {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON, to: JISOO })
    typeAmount(store, '30000')
    store.set(toConfirmAtom)
    const key = store.get(draftAtom)!.idempotencyKey
    store.set(failAtom, { code: 'NETWORK', outcome: 'unknown', message: '' })
    return { store, key }
  }

  it('실패해도 초안을 버리지 않는다', () => {
    const { store } = atFailure()
    expect(at(store)).toBe('failure')
    expect(store.get(draftAtom)?.to).toEqual(JISOO)
    expect(amountOf(store.get(draftAtom)!)).toBe(30_000)
  })

  it('금액을 고치면 키를 버린다 — 다른 금액은 다른 이체다', () => {
    const { store, key } = atFailure()
    store.set(editAmountAtom)
    expect(at(store)).toBe('enterAmount')
    store.set(editDraftAtom, (draft) => appendDigit(draft, '0'))
    expect(store.get(draftAtom)?.idempotencyKey).toBeNull()
    expect(store.get(draftAtom)?.idempotencyKey).not.toBe(key)
    expect(amountOf(store.get(draftAtom)!)).toBe(300_000)
  })

  // 실패 화면의 「확인하기」 가 또 실패하는 경로다. 결과를 모를 때 사용자가
  // 여러 번 누르는 것이 정상이므로 그때마다 화면이 쌓이면 안 된다.
  it('실패를 반복해도 스택이 자라지 않는다', () => {
    const { store } = atFailure()
    const afterFirst = store.get(navAtom).stack.map((s) => s.name)
    expect(afterFirst).toEqual(['enterAmount', 'confirm', 'failure'])

    for (let i = 0; i < 3; i++) store.set(failAtom, { code: 'NETWORK', outcome: 'unknown', message: '' })
    expect(store.get(navAtom).stack.map((s) => s.name)).toEqual(afterFirst)
  })

  it('마지막 실패가 화면에 남는다 — 앞의 것을 보여주지 않는다', () => {
    const { store } = atFailure()
    store.set(failAtom, { code: 'INSUFFICIENT_BALANCE', outcome: 'none', message: '' })
    expect(store.get(failureAtom)?.code).toBe('INSUFFICIENT_BALANCE')
  })
})

describe('플로우 종료', () => {
  it('초안과 실패를 함께 지우고 탭 뿌리로 간다', () => {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON, to: JISOO })
    typeAmount(store, '1000')
    store.set(toConfirmAtom)
    store.set(endFlowAtom)
    expect(at(store)).toBe('root')
    expect(store.get(draftAtom)).toBeNull()
    expect(store.get(failureAtom)).toBeNull()
  })
})

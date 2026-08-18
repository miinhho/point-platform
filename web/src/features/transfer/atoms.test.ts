import { describe, expect, it } from 'vitest'
import { createStore } from 'jotai'
import { currentScreenAtom, navAtom } from '@/app/atoms'
import {
  clearAmountAtom,
  digitAtom,
  draftAtom,
  editAmountAtom,
  endFlowAtom,
  failAtom,
  failureAtom,
  pickRecipientAtom,
  retryAtom,
  startTransferAtom,
  toConfirmAtom,
} from './atoms'
import { amountOf } from './draft'
import type { PointType, User } from '@/domain/types'

const ON: PointType = {
  id: 'pt_on',
  name: '온포인트',
  symbol: 'ON',
  issuerId: 'u_onmart',
  issuerName: '온마트',
  accent: 'blue',
  totalIssued: 50_000_000,
  issueCap: 100_000_000,
}
const JISOO: User = { id: 'u_jisoo', name: '김지수', handle: '@jisoo' }

const at = (store: ReturnType<typeof createStore>) => store.get(currentScreenAtom)?.name ?? 'root'

function typeAmount(store: ReturnType<typeof createStore>, digits: string) {
  for (const digit of digits) store.set(digitAtom, digit)
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
    store.set(digitAtom, '3')
    store.set(clearAmountAtom)
    expect(store.get(draftAtom)).toBeNull()
  })
})

describe('실패와 재시도', () => {
  function atFailure() {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON, to: JISOO })
    typeAmount(store, '30000')
    store.set(toConfirmAtom)
    const key = store.get(draftAtom)!.idempotencyKey
    store.set(failAtom, { code: 'NETWORK', message: '' })
    return { store, key }
  }

  it('실패해도 초안을 버리지 않는다', () => {
    const { store } = atFailure()
    expect(at(store)).toBe('failure')
    expect(store.get(draftAtom)?.to).toEqual(JISOO)
    expect(amountOf(store.get(draftAtom)!)).toBe(30_000)
  })

  it('재시도는 같은 멱등성 키로 확정 화면에 돌아간다', () => {
    const { store, key } = atFailure()
    store.set(retryAtom)
    expect(at(store)).toBe('confirm')
    expect(store.get(draftAtom)?.idempotencyKey).toBe(key)
    expect(store.get(failureAtom)).toBeNull()
  })

  it('재시도 뒤에도 확정 화면에서 금액으로 돌아갈 수 있다', () => {
    const { store } = atFailure()
    store.set(retryAtom)
    // 스택을 새로 만들면 여기서 홈으로 나가 버린다.
    expect(store.get(navAtom).stack.map((s) => s.name)).toEqual(['enterAmount', 'confirm'])
  })

  it('금액을 고치면 키를 버린다 — 다른 금액은 다른 이체다', () => {
    const { store, key } = atFailure()
    store.set(editAmountAtom)
    expect(at(store)).toBe('enterAmount')
    store.set(digitAtom, '0')
    expect(store.get(draftAtom)?.idempotencyKey).toBeNull()
    expect(store.get(draftAtom)?.idempotencyKey).not.toBe(key)
    expect(amountOf(store.get(draftAtom)!)).toBe(300_000)
  })

  it('실패를 반복해도 스택이 자라지 않는다', () => {
    const { store } = atFailure()
    const afterFirst = store.get(navAtom).stack.map((s) => s.name)
    expect(afterFirst).toEqual(['enterAmount', 'confirm', 'failure'])

    for (let i = 0; i < 3; i++) {
      store.set(retryAtom)
      store.set(failAtom, { code: 'NETWORK', message: '' })
    }
    // 재시도는 스택을 되감는 것이 아니라 되돌아가는 것이므로 길이 유지된다.
    expect(store.get(navAtom).stack.map((s) => s.name)).toEqual(afterFirst)
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

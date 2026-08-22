import { describe, expect, it } from 'vitest'
import { createStore } from 'jotai'
import type { PointType, User } from '@/shared/contract'
import {
  currentFlowAtom,
  editAmountAtom,
  endFlowAtom,
  failAtom,
  flowAtom,
  startTransferAtom,
  toConfirmAtom,
} from './atoms'
import { appendDigit } from './flow'

/**
 * 전이 자체는 `flow.test.ts` 가 본다. 여기는 **언제 부르는가** 쪽 — 흐름이 없을 때
 * 부르면 어떻게 되는가, 닫을 때 무엇이 함께 지워지는가.
 */
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
  membership: null,
  nameIsShared: false,
  accent: 'blue',
  totalIssued: 50_000_000,
  issueCap: 100_000_000,
  canIssue: false,
}
const JISOO: User = { id: 'u_jisoo', name: '김지수', handle: '@jisoo', nameIsShared: true }

it('흐름 밖에서 키를 눌러도 초안이 생기지 않는다', () => {
  const store = createStore()
  store.set(editAmountAtom, (draft) => appendDigit(draft, '3'))
  expect(store.get(flowAtom)).toBeNull()
})

describe('흐름을 닫는다', () => {
  function failed() {
    const store = createStore()
    store.set(startTransferAtom, { pointType: ON, to: JISOO })
    store.set(editAmountAtom, (draft) => appendDigit(draft, '1'))
    store.set(toConfirmAtom)
    store.set(failAtom, { code: 'NETWORK', outcome: 'unknown', message: '' })
    return store
  }

  it('초안과 실패가 함께 사라진다 — 다음 이체에 앞 실패가 남으면 안 된다', () => {
    const store = failed()
    expect(store.get(currentFlowAtom)?.step).toBe('failure')
    store.set(endFlowAtom)
    expect(store.get(flowAtom)).toBeNull()
    expect(store.get(currentFlowAtom)).toBeNull()
  })

  it('닫은 뒤 새로 시작하면 앞의 금액을 물려받지 않는다', () => {
    const store = failed()
    store.set(endFlowAtom)
    store.set(startTransferAtom, { pointType: ON, to: JISOO })
    expect(store.get(currentFlowAtom)?.draft.raw).toBe('')
  })
})

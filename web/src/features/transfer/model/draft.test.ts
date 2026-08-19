import { describe, expect, it } from 'vitest'
import {
  amountOf,
  appendDigit,
  clearAmount,
  isReady,
  removeDigit,
  seal,
  startDraft,
  withRecipient,
  type Draft,
} from './draft'
import type { PointType, User } from '@/api/contract'

const ON: PointType = {
  id: 'pt_on',
  name: '온포인트',
  symbol: 'ON',
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

const type = (draft: Draft, digits: string): Draft =>
  [...digits].reduce((acc, digit) => appendDigit(acc, digit), draft)

let counter = 0
const newKey = () => `k_${++counter}`

describe('초안', () => {
  it('포인트 없이는 시작하지 않는다 — 금액만으로는 아무것도 정해지지 않는다', () => {
    const draft = startDraft(ON)
    expect(draft.pointType.id).toBe('pt_on')
    expect(draft.to).toBeNull()
    expect(amountOf(draft)).toBe(0)
  })

  it('발행도 같은 초안을 쓴다', () => {
    expect(startDraft(ON, 'issue').kind).toBe('issue')
  })
})

describe('금액 입력', () => {
  const start = startDraft(ON)

  it('앞자리 0 을 막는다', () => {
    expect(appendDigit(start, '0')).toBe(start)
  })

  it('자릿수 상한을 넘기지 않는다', () => {
    const max = type(start, '1'.repeat(13))
    expect(appendDigit(max, '9')).toBe(max)
    expect(amountOf(max)).toBe(1_111_111_111_111)
  })

  it('한 글자 지우기와 전체 지우기', () => {
    const typed = type(start, '12345')
    expect(amountOf(removeDigit(typed))).toBe(1_234)
    expect(amountOf(clearAmount(typed))).toBe(0)
  })

  it('많이 친 뒤 전체삭제 한 번이면 처음으로 돌아간다', () => {
    expect(amountOf(clearAmount(type(start, '9'.repeat(13))))).toBe(0)
  })
})

describe('멱등성 키', () => {
  it('확정 화면에 들어갈 때 생긴다', () => {
    const sealed = seal(withRecipient(type(startDraft(ON), '30000'), JISOO), newKey)
    expect(sealed.idempotencyKey).toBeTruthy()
  })

  it('두 번 봉인해도 키가 바뀌지 않는다 — 재시도는 같은 키여야 한다', () => {
    const once = seal(withRecipient(type(startDraft(ON), '30000'), JISOO), newKey)
    expect(seal(once, newKey).idempotencyKey).toBe(once.idempotencyKey)
  })

  it('금액을 고치면 키를 버린다 — 다른 금액은 다른 이체다', () => {
    const sealed = seal(withRecipient(type(startDraft(ON), '30000'), JISOO), newKey)
    expect(appendDigit(sealed, '0').idempotencyKey).toBeNull()
    expect(removeDigit(sealed).idempotencyKey).toBeNull()
    expect(clearAmount(sealed).idempotencyKey).toBeNull()
  })

  it('대상을 고치면 키를 버린다 — 같은 키로 다른 사람에게 보내면 먼저 것이 돌아온다', () => {
    const sealed = seal(withRecipient(type(startDraft(ON), '30000'), JISOO), newKey)
    const other: User = { id: 'u_jisu', name: '김지수', handle: '@jisu', nameIsShared: true }
    expect(withRecipient(sealed, other).idempotencyKey).toBeNull()
  })
})

describe('확정 가능', () => {
  const withAll = withRecipient(type(startDraft(ON), '30000'), JISOO)

  it('대상·금액이 있고 상한 안이면 된다', () => {
    expect(isReady(withAll, 3_240_000)).toBe(true)
  })

  it('대상이 없으면 안 된다', () => {
    expect(isReady(type(startDraft(ON), '30000'), 3_240_000)).toBe(false)
  })

  it('0 이면 안 된다', () => {
    expect(isReady(withRecipient(startDraft(ON), JISOO), 3_240_000)).toBe(false)
  })

  it('상한을 넘으면 안 된다 — 확정 화면까지 가서 거절당하게 두지 않는다', () => {
    expect(isReady(withAll, 20_000)).toBe(false)
  })

  it('상한과 같으면 된다 — 전액 보내기를 막지 않는다', () => {
    expect(isReady(withAll, 30_000)).toBe(true)
  })
})

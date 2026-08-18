import { describe, expect, it } from 'vitest'
import { handleFailure } from './failure'
import { failureTitleKey, failureWhereKey } from '@/shared/i18n/keys'
import type { FailureCode } from '@/api/contract'

const ALL: FailureCode[] = [
  'INSUFFICIENT_BALANCE',
  'CAP_EXCEEDED',
  'NOT_ISSUER',
  'RECIPIENT_NOT_FOUND',
  'POINT_TYPE_NOT_FOUND',
  'NETWORK',
  'SERVER',
]

describe('handleFailure', () => {
  it('모든 코드가 처리 방침을 가진다 — 정의되지 않은 실패를 남기지 않는다', () => {
    for (const code of ALL) {
      expect(handleFailure(code, 'transfer')).toBeTypeOf('object')
    }
  })

  // 결과를 아는지는 이 함수가 답하지 않는다. 서버가 `outcome` 으로 답한다 —
  // 코드에서 파생하면 코드를 늘릴 때마다 표를 함께 늘려야 하고, 빠뜨리면
  // 확정된 실패를 「어디까지 갔는지 알 수 없어요」라고 말하게 된다.
  it('결과를 아는지를 코드에서 파생하지 않는다', () => {
    for (const code of ALL) {
      expect(handleFailure(code, 'transfer')).not.toHaveProperty('outcomeUnknown')
    }
  })

  it('같은 키로 다시 보낼 수 있는 것은 네트워크·서버뿐이다', () => {
    const retryable = ALL.filter((code) => handleFailure(code, 'transfer').retryable)
    expect(retryable).toEqual(['NETWORK', 'SERVER'])
  })

  it('권한 실패만 막다른 화면이다 — 나머지는 다음 행동이 있다', () => {
    const deadEnds = ALL.filter((code) => {
      const h = handleFailure(code, 'transfer')
      return !h.retryable && !h.editable && !h.repickable
    })
    expect(deadEnds).toEqual(['NOT_ISSUER', 'POINT_TYPE_NOT_FOUND'])
  })

  it('발행 실패는 유통량 기준으로 말한다고 표시한다', () => {
    expect(handleFailure('CAP_EXCEEDED', 'issue').aboutSupply).toBe(true)
    expect(handleFailure('CAP_EXCEEDED', 'transfer').aboutSupply).toBe(false)
  })
})

describe('문구 키', () => {
  it('모든 코드가 제목 키를 가진다', () => {
    for (const code of ALL) {
      expect(failureTitleKey(code)).toBe(`failure.${code}.title`)
    }
  })

  it('돈의 위치 문구는 이체와 발행이 갈린다', () => {
    expect(failureWhereKey('NETWORK', 'transfer')).toBe('failure.NETWORK.whereTransfer')
    expect(failureWhereKey('NETWORK', 'issue')).toBe('failure.NETWORK.whereIssue')
  })
})

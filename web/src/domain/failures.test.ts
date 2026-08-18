import { describe, expect, it } from 'vitest'
import { failureTitleKey, failureWhereKey, handleFailure } from './failures'
import type { FailureCode } from './types'

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

  it('결과를 알 수 없는 실패는 네트워크·서버뿐이다', () => {
    const unknown = ALL.filter((code) => handleFailure(code, 'transfer').outcomeUnknown)
    expect(unknown).toEqual(['NETWORK', 'SERVER'])
  })

  it('결과를 알 수 없을 때만 재시도를 권한다', () => {
    for (const code of ALL) {
      const handling = handleFailure(code, 'transfer')
      expect(handling.retryable).toBe(handling.outcomeUnknown)
    }
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
    expect(failureWhereKey('NETWORK', 'transfer')).not.toBe(failureWhereKey('NETWORK', 'issue'))
  })
})

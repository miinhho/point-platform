import { describe, expect, it } from 'vitest'
import { explainFailure } from './failures'
import type { FailureCode } from './types'

const ALL: FailureCode[] = [
  'INSUFFICIENT_BALANCE',
  'CAP_EXCEEDED',
  'NOT_CANCELLABLE',
  'RECIPIENT_NOT_FOUND',
  'NETWORK',
  'SERVER',
]

describe('explainFailure', () => {
  it('모든 코드가 돈의 위치를 말한다 — 이게 실패 화면의 존재 이유다', () => {
    for (const code of ALL) {
      const explanation = explainFailure(code, 'transfer')
      expect(explanation.title).toBeTruthy()
      expect(explanation.whereIsMoney).toBeTruthy()
    }
  })

  it('모든 코드가 적어도 하나의 다음 행동을 준다 — 막다른 화면을 만들지 않는다', () => {
    for (const code of ALL) {
      const e = explainFailure(code, 'transfer')
      // 아무것도 없으면 "홈으로" 만 남는데, 그건 사용자가 하려던 일을 포기시키는 것이다.
      const hasAction = e.retryable || e.editable || e.repickable
      const isJustWaiting = code === 'NOT_CANCELLABLE'
      expect(hasAction || isJustWaiting).toBe(true)
    }
  })

  it('결과를 알 수 없는 실패는 네트워크·서버뿐이다', () => {
    const unknown = ALL.filter((code) => explainFailure(code, 'transfer').outcomeUnknown)
    expect(unknown).toEqual(['NETWORK', 'SERVER'])
  })

  it('결과를 알 수 없을 때만 재시도를 권한다', () => {
    for (const code of ALL) {
      const e = explainFailure(code, 'transfer')
      expect(e.retryable).toBe(e.outcomeUnknown)
    }
  })

  it('결과를 아는 실패는 돈이 움직이지 않았다고 단정한다', () => {
    expect(explainFailure('INSUFFICIENT_BALANCE', 'transfer').whereIsMoney).toContain('잔액은 그대로')
    expect(explainFailure('CAP_EXCEEDED', 'issue').whereIsMoney).toContain('총 유통량은 그대로')
  })

  it('결과를 모르는 실패는 단정하지 않고, 재시도가 안전한 이유를 말한다', () => {
    for (const code of ['NETWORK', 'SERVER'] as const) {
      const e = explainFailure(code, 'transfer')
      expect(e.whereIsMoney).toContain('알 수 없다')
      expect(e.whereIsMoney).toContain('두 번 처리되지 않는다')
    }
  })

  it('발행은 잔액이 아니라 유통량으로 말한다', () => {
    expect(explainFailure('INSUFFICIENT_BALANCE', 'issue').whereIsMoney).toContain('유통량')
  })
})

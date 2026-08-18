import { describe, expect, it } from 'vitest'
import { toGrouped } from '@/shared/format'
import { amountFontSize } from './amountFit'

describe('amountFontSize', () => {
  it('평범한 금액은 가장 크게 둔다', () => {
    expect(amountFontSize(toGrouped(30_000))).toBe(amountFontSize('0'))
    expect(amountFontSize(toGrouped(123_456_789))).toBe(amountFontSize('0'))
  })

  it('자릿수가 늘면 단계적으로 줄인다', () => {
    const normal = amountFontSize(toGrouped(123_456_789))
    const long = amountFontSize(toGrouped(1_234_567_891))
    const longest = amountFontSize(toGrouped(1_234_567_891_234))
    expect(long).not.toBe(normal)
    expect(longest).not.toBe(long)
  })

  it('입력 상한(13자리)까지 크기가 정의된다 — 잘리는 구간을 남기지 않는다', () => {
    expect(amountFontSize(toGrouped(9_999_999_999_999))).toBeTruthy()
  })
})

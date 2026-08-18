import { describe, expect, it } from 'vitest'
import { formatRate, inflationRate } from './ledger'

describe('formatRate', () => {
  it('0 은 0 이다', () => {
    expect(formatRate(0)).toBe('0%')
  })

  // 이 테스트가 이 파일의 존재 이유다.
  it('작은 값을 0 으로 반올림하지 않는다 — 작은 것과 없는 것은 다르다', () => {
    expect(formatRate(0.04)).toBe('0.04%')
    expect(formatRate(0.004)).toBe('0.01% 미만')
    expect(formatRate(0.04)).not.toBe('0.0%')
  })

  it('큰 값은 한 자리로 충분하다', () => {
    expect(formatRate(6.48)).toBe('6.5%')
    expect(formatRate(120)).toBe('120.0%')
  })

  it('음수도 다룬다', () => {
    expect(formatRate(-0.001)).toBe('-0.01% 미만')
  })
})

describe('inflationRate', () => {
  it('총 유통량 대비 비율', () => {
    expect(inflationRate(20_000, 50_000_000)).toBeCloseTo(0.04)
    expect(inflationRate(1_000_000, 50_000_000)).toBeCloseTo(2)
  })

  it('유통량이 0 이면 비율이 없다', () => {
    expect(inflationRate(100, 0)).toBe(0)
  })
})

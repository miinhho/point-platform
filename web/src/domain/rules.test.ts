import { describe, expect, it } from 'vitest'
import { HOLD_MS, MAX_AMOUNT_DIGITS } from './rules'

describe('홀드', () => {
  it('금액과 무관한 상수다 — 위험도 전달이 아니라 오터치 방지가 목적이다', () => {
    expect(HOLD_MS).toBeGreaterThan(0)
  })

  it('오터치를 막을 만큼 길고, 기다림으로 느껴지지 않을 만큼 짧다', () => {
    // 300ms 미만이면 스크롤 중 스침과 구분되지 않고, 1초를 넘으면 매 이체가 대기가 된다.
    expect(HOLD_MS).toBeGreaterThanOrEqual(300)
    expect(HOLD_MS).toBeLessThanOrEqual(1000)
  })
})

describe('입력 상한', () => {
  it('한글 표기가 성립하는 범위 안이다', () => {
    expect(MAX_AMOUNT_DIGITS).toBeLessThanOrEqual(16)
  })
})

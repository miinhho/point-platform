import { describe, expect, it } from 'vitest'
import { cancelWindowFor, cancelWindowRemaining, HOLD_MS, isInCancelWindow } from './rules'

const UNTIL = '2026-08-18T00:00:03.000Z'
const AT = (iso: string) => Date.parse(iso)

describe('취소 창', () => {
  it('발행이 이체보다 길다 — 회수 불가능성이 다르다', () => {
    expect(cancelWindowFor('issue')).toBeGreaterThan(cancelWindowFor('transfer'))
  })

  it('경계 시각은 이미 창 밖이다 — 애매한 순간에는 취소되지 않는 쪽으로 판단한다', () => {
    expect(isInCancelWindow(UNTIL, AT('2026-08-18T00:00:02.999Z'))).toBe(true)
    expect(isInCancelWindow(UNTIL, AT(UNTIL))).toBe(false)
    expect(isInCancelWindow(UNTIL, AT('2026-08-18T00:00:03.001Z'))).toBe(false)
  })

  it('남은 시간은 음수가 되지 않는다', () => {
    expect(cancelWindowRemaining(UNTIL, AT('2026-08-18T00:00:01.000Z'))).toBe(2000)
    expect(cancelWindowRemaining(UNTIL, AT('2026-08-18T00:00:09.000Z'))).toBe(0)
  })
})

describe('홀드', () => {
  it('금액과 무관한 상수다 — 위험도 전달이 아니라 오터치 방지가 목적이다', () => {
    expect(typeof HOLD_MS).toBe('number')
    expect(HOLD_MS).toBeGreaterThan(0)
  })
})

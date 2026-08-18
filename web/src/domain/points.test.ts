import { describe, expect, it } from 'vitest'
import { abbreviate, label, parseInput, toGrouped } from './points'

describe('toGrouped', () => {
  it('세 자리마다 쉼표', () => {
    expect(toGrouped(1_500_000)).toBe('1,500,000')
    expect(toGrouped(0)).toBe('0')
  })
})

describe('abbreviate', () => {
  // 이 테스트가 이 파일의 존재 이유다.
  it('0 하나 차이가 갈라진다', () => {
    expect(abbreviate(1_500_000)).toBe('150만')
    expect(abbreviate(15_000_000)).toBe('1,500만')
  })

  it('만 단위로 끊는다', () => {
    expect(abbreviate(10_000)).toBe('1만')
    expect(abbreviate(20_000)).toBe('2만')
    expect(abbreviate(300_000)).toBe('30만')
    expect(abbreviate(3_000_000)).toBe('300만')
    expect(abbreviate(30_000_000)).toBe('3,000만')
  })

  // 작은 금액에서 "이만" 같은 표기는 읽히지 않는다. 오타 위험도 여기 없다.
  it('만 미만은 병기하지 않는다', () => {
    expect(abbreviate(0)).toBe('')
    expect(abbreviate(9_999)).toBe('')
    expect(abbreviate(1_000)).toBe('')
  })

  it('억·조 단위를 끊어 읽는다', () => {
    expect(abbreviate(100_000_000)).toBe('1억')
    expect(abbreviate(123_456_789)).toBe('1억 2,345만 6,789')
    expect(abbreviate(1_000_000_000_000)).toBe('1조')
    expect(abbreviate(1_111_111_111_111)).toBe('1조 1,111억 1,111만 1,111')
  })

  it('0 인 자리는 건너뛴다', () => {
    expect(abbreviate(100_010_000)).toBe('1억 1만')
  })

  it('경을 넘으면 조용히 틀린 값 대신 빈 문자열', () => {
    expect(abbreviate(1e20)).toBe('')
  })
})

describe('label', () => {
  it('두 표기를 함께 만든다', () => {
    expect(label(1_500_000)).toEqual({ grouped: '1,500,000', short: '150만' })
  })

  it('만 미만이면 병기가 비어 있다', () => {
    expect(label(5_000)).toEqual({ grouped: '5,000', short: '' })
  })
})

describe('parseInput', () => {
  it('숫자만 남긴다', () => {
    expect(parseInput('1,500,000')).toBe(1_500_000)
    expect(parseInput('')).toBe(0)
    expect(parseInput('abc')).toBe(0)
  })
})

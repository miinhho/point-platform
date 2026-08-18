import { describe, expect, it } from 'vitest'
import { label, parseInput, toGrouped, toKorean } from './points'

/**
 * 한글 병기는 장식이 아니라 검증 수단이다 (docs/JOURNEY.md 여정 3).
 * 자릿수 오타를 눈에 띄게 만드는 것이 유일한 목적이므로,
 * "표기가 갈라지는가"가 이 테스트의 관심사다.
 */
describe('toKorean', () => {
  it('0 은 영', () => {
    expect(toKorean(0)).toBe('영')
  })

  it('한 자리', () => {
    expect(toKorean(1)).toBe('일')
    expect(toKorean(9)).toBe('구')
  })

  it('십·백·천의 1 은 생략한다', () => {
    expect(toKorean(10)).toBe('십')
    expect(toKorean(100)).toBe('백')
    expect(toKorean(1_000)).toBe('천')
    expect(toKorean(1_100)).toBe('천백')
  })

  it('만 단위의 1 은 남긴다 — 자릿수를 분명히 하려는 것이다', () => {
    expect(toKorean(10_000)).toBe('일만')
    expect(toKorean(100_000_000)).toBe('일억')
  })

  it('0 이 있는 자리는 건너뛴다', () => {
    expect(toKorean(101)).toBe('백일')
    expect(toKorean(1_0001)).toBe('일만일')
    expect(toKorean(20_000_000)).toBe('이천만')
  })

  // 이 테스트가 이 파일의 존재 이유다.
  it('150만과 1500만이 다르게 읽힌다', () => {
    expect(toKorean(1_500_000)).toBe('백오십만')
    expect(toKorean(15_000_000)).toBe('천오백만')
  })

  it('0 하나 차이가 전부 갈라진다', () => {
    expect(toKorean(30_000)).toBe('삼만')
    expect(toKorean(300_000)).toBe('삼십만')
    expect(toKorean(3_000_000)).toBe('삼백만')
    expect(toKorean(30_000_000)).toBe('삼천만')
  })

  it('억·조 단위', () => {
    expect(toKorean(123_456_789)).toBe('일억이천삼백사십오만육천칠백팔십구')
    expect(toKorean(1_0000_0000_0000)).toBe('일조')
  })

  it('경을 넘으면 조용히 틀린 값 대신 빈 문자열', () => {
    expect(toKorean(1e20)).toBe('')
  })
})

describe('toGrouped', () => {
  it('세 자리마다 쉼표', () => {
    expect(toGrouped(1_500_000)).toBe('1,500,000')
    expect(toGrouped(0)).toBe('0')
  })
})

describe('label', () => {
  it('두 표기를 함께 만든다 — 따로 쓰지 못하게 묶는다', () => {
    expect(label(1_500_000)).toEqual({
      grouped: '1,500,000',
      korean: '백오십만',
      withUnit: '1,500,000 P',
      koreanWithUnit: '백오십만 포인트',
    })
  })

  it('한글을 만들 수 없으면 koreanWithUnit 은 비운다', () => {
    expect(label(1e20).koreanWithUnit).toBe('')
  })
})

describe('parseInput', () => {
  it('숫자만 남긴다', () => {
    expect(parseInput('1,500,000')).toBe(1_500_000)
    expect(parseInput('15만')).toBe(15)
  })

  it('빈 입력은 0', () => {
    expect(parseInput('')).toBe(0)
    expect(parseInput('abc')).toBe(0)
  })

  it('앞자리 0 을 그대로 해석하지 않는다', () => {
    expect(parseInput('007')).toBe(7)
  })
})

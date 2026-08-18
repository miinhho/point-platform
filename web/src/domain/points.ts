// 포인트 표기. 헌법 6조 — 금액은 항상 두 표기를 나란히 둔다.
//
//   1,500,000 P
//   백오십만 포인트
//
// 자릿수 오타(150만 → 1500만)는 숫자만 보면 놓치지만 한글 표기에서는 즉시 눈에 띈다.
// 이것이 이 파일이 존재하는 유일한 이유다.

import type { Points } from './types'

const DIGIT = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL_UNIT = ['', '십', '백', '천']
const BIG_UNIT = ['', '만', '억', '조', '경']

/** 1 ~ 9999 를 한글로. 십·백·천 자리의 1은 생략한다 (일십 → 십). */
function groupToKorean(group: number): string {
  let result = ''
  for (let unitIndex = 3; unitIndex >= 0; unitIndex--) {
    const digit = Math.floor(group / 10 ** unitIndex) % 10
    if (digit === 0) continue
    // 십·백·천의 1은 생략하지만, 일의 자리 1은 남긴다.
    // 만 단위 그룹의 1도 남는다 (10000 → "일만") — 자릿수를 분명히 하려는 것이다.
    result += digit === 1 && unitIndex > 0 ? SMALL_UNIT[unitIndex] : DIGIT[digit] + SMALL_UNIT[unitIndex]
  }
  return result
}

/** 정수를 한글 수 표기로. 음수와 소수는 다루지 않는다 (Points 는 0 이상 정수). */
export function toKorean(amount: Points): string {
  if (amount === 0) return '영'

  const groups: number[] = []
  let rest = Math.floor(amount)
  while (rest > 0) {
    groups.push(rest % 10000)
    rest = Math.floor(rest / 10000)
  }

  if (groups.length > BIG_UNIT.length) {
    // 경 단위를 넘으면 한글 표기를 포기하되, 조용히 틀린 값을 내놓지는 않는다.
    return ''
  }

  let result = ''
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    result += groupToKorean(groups[i]) + BIG_UNIT[i]
  }
  return result
}

/** 1500000 → "1,500,000" */
export function toGrouped(amount: Points): string {
  return amount.toLocaleString('ko-KR')
}

/** 화면에 나란히 둘 두 표기를 함께 만든다. 둘을 따로 쓰지 못하게 묶는다. */
export interface PointsLabel {
  /** "1,500,000" */
  grouped: string
  /** "백오십만" — 비어 있으면 한글 표기를 만들 수 없었다는 뜻이다. */
  korean: string
  /** "1,500,000 P" */
  withUnit: string
  /** "백오십만 포인트" */
  koreanWithUnit: string
}

export const UNIT_SYMBOL = 'P'
export const UNIT_NAME = '포인트'

export function label(amount: Points): PointsLabel {
  const grouped = toGrouped(amount)
  const korean = toKorean(amount)
  return {
    grouped,
    korean,
    withUnit: `${grouped} ${UNIT_SYMBOL}`,
    koreanWithUnit: korean ? `${korean} ${UNIT_NAME}` : '',
  }
}

/** 키패드 입력을 Points 로. 최소 단위가 1P 이므로 정수만 받는다. */
export function parseInput(raw: string): Points {
  const digitsOnly = raw.replace(/\D/g, '')
  if (digitsOnly === '') return 0
  return Number.parseInt(digitsOnly, 10)
}

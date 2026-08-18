// 금액 표기 (docs/JOURNEY.md 여정 4).
//
// 자릿수 오타(150만 → 1500만)는 숫자만 보면 놓친다. 그것을 잡는 것이 이 파일의
// 존재 이유이고, 잡지 못하는 표기는 넣지 않는다.

import type { Points } from './types'

/** 1500000 → "1,500,000" */
export function toGrouped(amount: Points): string {
  return amount.toLocaleString('ko-KR')
}

const BIG_UNIT = ['', '만', '억', '조', '경'] as const

/**
 * 만 단위로 끊어 읽는 표기. `1,500,000` → `150만`, `15,000,000` → `1,500만`.
 *
 * 사람이 실제로 말하는 단위로 끊는다. 순한글("백오십만")은 큰 금액에서는
 * 갈라지지만 작은 금액에서 "이만" 처럼 어색해지고, 어색한 표기는 읽히지 않는다.
 */
export function abbreviate(amount: Points): string {
  if (!Number.isFinite(amount) || amount < 10_000) return ''

  const groups: number[] = []
  let rest = Math.floor(amount)
  while (rest > 0) {
    groups.push(rest % 10_000)
    rest = Math.floor(rest / 10_000)
  }
  if (groups.length > BIG_UNIT.length) return ''

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    parts.push(`${groups[i].toLocaleString('ko-KR')}${BIG_UNIT[i]}`)
  }
  return parts.join(' ')
}

/** 화면에 함께 둘 두 표기. 둘을 따로 쓰지 못하게 묶는다. */
export interface PointsLabel {
  /** "1,500,000" */
  grouped: string
  /** "150만" — 만 미만이면 비어 있다 */
  short: string
}

export function label(amount: Points): PointsLabel {
  return { grouped: toGrouped(amount), short: abbreviate(amount) }
}

/** 키패드 입력을 Points 로. 최소 단위가 1 이므로 정수만 받는다. */
export function parseInput(raw: string): Points {
  const digitsOnly = raw.replace(/\D/g, '')
  return digitsOnly === '' ? 0 : Number.parseInt(digitsOnly, 10)
}

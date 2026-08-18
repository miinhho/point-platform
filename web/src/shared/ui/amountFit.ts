// 근거: docs/JOURNEY.md 여정 4
const FULL = 'clamp(2.125rem, 11vw, 2.875rem)'
const MID = 'clamp(1.75rem, 8.5vw, 2.25rem)'
const SMALL = 'clamp(1.375rem, 6.5vw, 1.75rem)'

/** @param grouped 쉼표가 들어간 표기 ("1,234,567") */
export function amountFontSize(grouped: string): string {
  if (grouped.length >= 15) return SMALL
  if (grouped.length >= 12) return MID
  return FULL
}

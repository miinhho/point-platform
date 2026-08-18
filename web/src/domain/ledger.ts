
// 작은 것과 없는 것은 다르다. 반올림으로 0% 를 만들지 않는다.
export function formatRate(rate: number): string {
  if (rate === 0) return '0%'

  const magnitude = Math.abs(rate)
  if (magnitude < 0.01) return rate > 0 ? '0.01% 미만' : '-0.01% 미만'

  const digits = magnitude < 0.1 ? 2 : magnitude < 1 ? 1 : 1
  return `${rate.toFixed(digits)}%`
}

/** 발행이 총 유통량을 몇 % 늘리는가. 유통량이 0 이면 비율이 정의되지 않는다. */
export function inflationRate(amount: number, totalIssued: number): number {
  return totalIssued === 0 ? 0 : (amount / totalIssued) * 100
}

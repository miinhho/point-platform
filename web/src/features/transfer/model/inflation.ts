// 발행이 기존 보유자에게 무엇을 하는지 — docs/JOURNEY.md 여정 7
// 작은 것과 없는 것은 다르다. 반올림으로 0% 를 만들지 않는다.
export function formatRate(rate: number): string {
  if (rate === 0) return '0%'

  const magnitude = Math.abs(rate)
  if (magnitude < 0.01) return rate > 0 ? '0.01% 미만' : '-0.01% 미만'

  return `${rate.toFixed(magnitude < 0.1 ? 2 : 1)}%`
}

/** 유통량이 0 이면 비율이 없다. `0%` 는 거짓이다 — 첫 발행은 무한 증가다. */
export function inflationRate(amount: number, totalIssued: number): number | null {
  return totalIssued === 0 ? null : (amount / totalIssued) * 100
}

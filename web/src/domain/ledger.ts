/**
 * 원장 비율 표기.
 *
 * 발행 확정 화면의 "유통량 변화"는 크기를 전달하려고 넣은 값이다. 그런데 고정
 * 소수점으로 두면 5천만 중 2만을 발행할 때 `+0.0%` 가 되어, **크기를 전달하려던
 * 값이 "변화 없음"으로 읽힌다.** 작은 것은 작다고 말해야지 없다고 말하면 안 된다.
 *
 * 그래서 유효 자릿수를 값에 맞춘다.
 */
export function formatRate(rate: number): string {
  if (rate === 0) return '0%'

  const magnitude = Math.abs(rate)
  // 표기할 수 있는 가장 작은 값보다 작으면, 반올림해서 0 으로 만들지 않고 그렇게 말한다.
  if (magnitude < 0.01) return rate > 0 ? '0.01% 미만' : '-0.01% 미만'

  const digits = magnitude < 0.1 ? 2 : magnitude < 1 ? 1 : 1
  return `${rate.toFixed(digits)}%`
}

/** 발행이 총 유통량을 몇 % 늘리는가. 유통량이 0 이면 비율이 정의되지 않는다. */
export function inflationRate(amount: number, totalIssued: number): number {
  return totalIssued === 0 ? 0 : (amount / totalIssued) * 100
}

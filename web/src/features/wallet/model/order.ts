import type { Balance } from '@/shared/contract'

/** 근거: docs/JOURNEY.md 여정 1 */
export function orderBalances(balances: Balance[]): Balance[] {
  return groupByName([...balances].sort(compare))
}

function compare(a: Balance, b: Balance): number {
  // 가진 것과 가졌던 것을 가른다.
  const zero = Number(a.amount === 0) - Number(b.amount === 0)
  if (zero !== 0) return zero
  return b.amount - a.amount
}

/**
 * 같은 이름을 첫 등장 자리로 끌어온다. 떨어져 있으면 둘이 있다는 사실 자체를 모른다.
 * 잔액 순서는 그 안에서만 지켜진다 — 겹침을 아는 것이 순서보다 중요하다.
 */
function groupByName(sorted: Balance[]): Balance[] {
  const emitted = new Set<string>()
  const out: Balance[] = []
  for (const balance of sorted) {
    if (emitted.has(balance.pointType.id)) continue
    for (const sibling of sorted) {
      if (sibling.pointType.name !== balance.pointType.name) continue
      if (emitted.has(sibling.pointType.id)) continue
      emitted.add(sibling.pointType.id)
      out.push(sibling)
    }
  }
  return out
}

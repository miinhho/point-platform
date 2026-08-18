import type { Balance, Points } from '@/domain/types'
import type { Draft } from './draft'

/** 이체는 잔액, 발행은 남은 발행 여력이다 — docs/JOURNEY.md 여정 4·7 */
export function ceilingOf(draft: Draft, balances: Balance[] | undefined): Points {
  if (draft.kind === 'issue') {
    const { issueCap, totalIssued } = draft.pointType
    return Math.max(0, issueCap - totalIssued)
  }
  return balances?.find((b) => b.pointType.id === draft.pointType.id)?.amount ?? 0
}

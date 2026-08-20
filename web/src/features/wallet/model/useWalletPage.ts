import { useQuery } from '@tanstack/react-query'
import { invitesQuery, walletQuery } from '@/shared/api'
import type { Balance, Invite } from '@/shared/contract'
import { orderBalances } from './order'

export interface WalletPageView {
  pending: boolean
  failed: boolean
  retry: () => void
  /** 자리를 잡아 둘 만큼은 답이 왔는가 */
  loaded: boolean
  balances: Balance[]
  invites: Invite[]
  /**
   * 지갑이 답했는데 가진 것도 초대도 없다. **못 불러온 것과 다르다** —
   * 규칙: CLAUDE.md 「없는 것과 못 불러온 것을 같게 보이지 않는다」
   */
  empty: boolean
}

/** 근거: docs/JOURNEY.md 여정 1 */
export function useWalletPage(): WalletPageView {
  const wallet = useQuery(walletQuery())
  const invites = useQuery(invitesQuery())

  return {
    pending: wallet.isPending,
    failed: wallet.isError,
    retry: () => void wallet.refetch(),
    loaded: wallet.isSuccess,
    balances: wallet.data ? orderBalances(wallet.data.balances) : [],
    invites: invites.data ?? [],
    empty: wallet.data?.balances.length === 0 && invites.data?.length === 0,
  }
}

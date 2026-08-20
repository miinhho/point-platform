import { useQuery } from '@tanstack/react-query'
import { read, recentQuery, usersQuery, walletQuery } from '@/shared/api'
import type { Balance, Points, PointTypeId, Transfer, Issue } from '@/shared/contract'
import { buildRecipientList, buildSearchList, type RecipientList } from './recipientList'
import type { SealedDraft } from './flow'

/**
 * 지금 보낼 수 있는 양. 서버가 실어 준 값을 고를 뿐이다.
 * 못 불러왔으면 0 이다 — 낡은 상한으로 다음 화면을 열어 주지 않는다.
 */
export function useSendable(pointTypeId: PointTypeId): Points {
  const wallet = read(useQuery(walletQuery()))
  return wallet.data?.balances.find((b) => b.pointType.id === pointTypeId)?.sendable ?? 0
}

export interface RecipientsView {
  pending: boolean
  failed: boolean
  retry: () => void
  list: RecipientList
  total: number
}

/** 근거: docs/JOURNEY.md 여정 3 */
export function useRecipients(pointTypeId: PointTypeId, query: string): RecipientsView {
  const searching = query.trim().length > 0
  // 비공개 은행이면 회원만 온다. 목록에 없는 사람에게는 보낼 수도 없다.
  const users = read(useQuery(usersQuery(query.trim(), pointTypeId)))
  const recent = read(useQuery(recentQuery(pointTypeId)))

  const list = searching
    ? buildSearchList(users.data ?? [])
    : buildRecipientList(recent.data ?? [], users.data ?? [])

  return {
    pending: users.pending,
    failed: users.failed,
    retry: users.retry,
    list,
    total: list.recent.length + list.others.length,
  }
}

export interface TransferConfirmView {
  pending: boolean
  failed: boolean
  retry: () => void
  /**
   * 지금 잔액. **못 불러왔으면 `null` 이다** — 0 으로 접으면 「보낸 뒤 남는 잔액」이
   * 음수가 되고, 되돌릴 수 없는 것 직전에 화면이 거짓을 말한다.
   */
  balance: Points | null
  held: Balance | null
  /** 처음 받는 사람인가. 경고가 아니라 사실로 한 줄 적는 자리다 */
  firstTime: boolean
}

/** 근거: docs/JOURNEY.md 여정 5 */
export function useTransferConfirm(draft: SealedDraft): TransferConfirmView {
  const wallet = read(useQuery(walletQuery()))
  const recent = read(useQuery(recentQuery(draft.pointType.id)))
  const held = wallet.data?.balances.find((b) => b.pointType.id === draft.pointType.id) ?? null

  return {
    pending: wallet.pending,
    failed: wallet.failed,
    retry: wallet.retry,
    balance: wallet.data ? (held?.amount ?? 0) : null,
    held,
    firstTime: recent.data ? !recent.data.some((user) => user.id === draft.to.id) : false,
  }
}

export interface ResultView {
  /**
   * 보낸 뒤 남은 잔액. 지갑이 답했는데 그 포인트가 없으면 **0** 이다 — 잔액 0 이면서
   * 발행자가 아닌 포인트는 목록에서 빠지고, 전액을 보내면 정확히 그 상태가 된다.
   * 못 불러온 것은 `null` 이라 둘이 갈린다. 근거: docs/JOURNEY.md 여정 1
   */
  remaining: Points | null
  failed: boolean
}

export function useResult(result: Transfer | Issue): ResultView {
  const wallet = read(useQuery(walletQuery()))
  return {
    remaining: wallet.data
      ? (wallet.data.balances.find((b) => b.pointType.id === result.pointTypeId)?.amount ?? 0)
      : null,
    failed: wallet.failed,
  }
}

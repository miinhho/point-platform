import { useQuery } from '@tanstack/react-query'
import { historyQuery, issueQuery, transferQuery } from '@/shared/api'
import type { HistoryEntry, IssueDetail, IssueId, TransferDetail, TransferId } from '@/shared/contract'

/** 조회 하나를 화면이 그리는 모양으로. 셋 다 세 상태를 그대로 넘긴다 */
interface Read<T> {
  pending: boolean
  failed: boolean
  retry: () => void
  data: T | null
}

/** 근거: docs/JOURNEY.md 여정 8 */
export function useHistoryPage(): Read<HistoryEntry[]> {
  const list = useQuery(historyQuery())
  return {
    pending: list.isPending,
    failed: list.isError,
    retry: () => void list.refetch(),
    data: list.data ?? null,
  }
}

export function useTransferDetail(transferId: TransferId): Read<TransferDetail> {
  const one = useQuery(transferQuery(transferId))
  return {
    pending: one.isPending,
    failed: one.isError,
    retry: () => void one.refetch(),
    data: one.data ?? null,
  }
}

export function useIssueDetail(issueId: IssueId): Read<IssueDetail> {
  const one = useQuery(issueQuery(issueId))
  return {
    pending: one.isPending,
    failed: one.isError,
    retry: () => void one.refetch(),
    data: one.data ?? null,
  }
}

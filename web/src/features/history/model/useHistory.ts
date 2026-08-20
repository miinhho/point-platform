import { useQuery } from '@tanstack/react-query'
import { historyQuery, issueQuery, read, transferQuery, type Read } from '@/shared/api'
import type { HistoryEntry, IssueDetail, IssueId, TransferDetail, TransferId } from '@/shared/contract'

/** 근거: docs/JOURNEY.md 여정 8 */
export function useHistoryPage(): Read<HistoryEntry[]> {
  return read(useQuery(historyQuery()))
}

export function useTransferDetail(transferId: TransferId): Read<TransferDetail> {
  return read(useQuery(transferQuery(transferId)))
}

export function useIssueDetail(issueId: IssueId): Read<IssueDetail> {
  return read(useQuery(issueQuery(issueId)))
}

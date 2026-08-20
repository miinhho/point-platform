import { queryOptions } from '@tanstack/react-query'
import type { HistoryEntry, PointTypeId } from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

export interface HistoryQuery {
  /** 특정 포인트의 내역만 */
  pointTypeId?: PointTypeId
  limit?: number
}

export const historyApi = {
  history: (params: HistoryQuery = {}, options?: RequestOptions) =>
    request<HistoryEntry[]>('/history', {
      ...options,
      query: { pointTypeId: params.pointTypeId, limit: params.limit },
    }),
}

export const historyQuery = () =>
  queryOptions({ queryKey: queryKeys.history, queryFn: () => historyApi.history() })

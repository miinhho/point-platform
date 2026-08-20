import { queryOptions } from '@tanstack/react-query'
import type { Points, PointTypeId, Transfer, TransferDetail, TransferId, UserId } from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

export interface CreateTransferInput {
  pointTypeId: PointTypeId
  toId: UserId
  amount: Points
}

export const transfersApi = {
  createTransfer: (input: CreateTransferInput, idempotencyKey: string) =>
    request<Transfer>('/transfers', { method: 'POST', body: input, idempotencyKey }),

  transfer: (id: TransferId, options?: RequestOptions) =>
    request<TransferDetail>(`/transfers/${id}`, options),

  /**
   * 결과를 알 수 없는 실패 뒤에 "정말 안 일어났나" 를 확인한다.
   * 응답을 못 받은 클라이언트는 id 를 모르므로 키로 묻는다.
   */
  transferByKey: (idempotencyKey: string, options?: RequestOptions) =>
    request<Transfer | null>('/transfers/by-key', { ...options, query: { idempotencyKey } }),
}

export const transferQuery = (transferId: TransferId) =>
  queryOptions({
    queryKey: queryKeys.transfer(transferId),
    queryFn: () => transfersApi.transfer(transferId),
  })

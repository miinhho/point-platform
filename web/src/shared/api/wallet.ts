import { queryOptions } from '@tanstack/react-query'
import type { Wallet } from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

export const walletApi = {
  /** 내가 가진 포인트별 잔액 전부 */
  wallet: (options?: RequestOptions) => request<Wallet>('/wallet', options),
}

export const walletQuery = () =>
  queryOptions({ queryKey: queryKeys.wallet, queryFn: () => walletApi.wallet() })

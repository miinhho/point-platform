import { queryOptions } from '@tanstack/react-query'
import { endpoints } from './endpoints'

export const queryKeys = {
  wallet: ['wallet'] as const,
}

export const walletQuery = () =>
  queryOptions({ queryKey: queryKeys.wallet, queryFn: () => endpoints.wallet() })

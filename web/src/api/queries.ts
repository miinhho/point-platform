import { queryOptions } from '@tanstack/react-query'
import type { PointTypeId } from '@/domain/types'
import { endpoints } from './endpoints'

export const queryKeys = {
  wallet: ['wallet'] as const,
  users: (query: string) => ['users', query] as const,
  recent: (pointTypeId: PointTypeId) => ['recent', pointTypeId] as const,
}

export const walletQuery = () =>
  queryOptions({ queryKey: queryKeys.wallet, queryFn: () => endpoints.wallet() })

export const usersQuery = (query: string) =>
  queryOptions({
    queryKey: queryKeys.users(query),
    queryFn: () => endpoints.users(query),
    // 글자를 칠 때마다 목록이 비었다가 차면 찾던 사람이 사라진 것처럼 보인다.
    placeholderData: (previous) => previous,
  })

export const recentQuery = (pointTypeId: PointTypeId) =>
  queryOptions({
    queryKey: queryKeys.recent(pointTypeId),
    queryFn: () => endpoints.recent(pointTypeId),
  })

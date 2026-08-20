import { queryOptions } from '@tanstack/react-query'
import type { PointTypeId, User } from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

export const usersApi = {
  /** 비공개 은행이면 회원만 온다 — 계약: docs/API.md 「회원 자격」 */
  users: (query?: string, pointTypeId?: PointTypeId, options?: RequestOptions) =>
    request<User[]>('/users', {
      ...options,
      query: { q: query || undefined, pointTypeId },
    }),

  /** 포인트마다 다르다. */
  recent: (pointTypeId: PointTypeId, limit?: number, options?: RequestOptions) =>
    request<User[]>('/recent', { ...options, query: { pointTypeId, limit } }),
}

/** 보낼 포인트가 정해져 있으면 그 은행에서 받을 수 있는 사람만 온다 */
export const usersQuery = (query: string, pointTypeId?: PointTypeId) =>
  queryOptions({
    queryKey: queryKeys.users(query, pointTypeId),
    queryFn: () => usersApi.users(query, pointTypeId),
    // 글자를 칠 때마다 목록이 비었다가 차면 찾던 사람이 사라진 것처럼 보인다.
    placeholderData: (previous) => previous,
  })

export const recentQuery = (pointTypeId: PointTypeId) =>
  queryOptions({
    queryKey: queryKeys.recent(pointTypeId),
    queryFn: () => usersApi.recent(pointTypeId),
  })

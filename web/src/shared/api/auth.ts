import { queryOptions } from '@tanstack/react-query'
import type { User } from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

export interface Credentials {
  handle: string
  password: string
}

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export interface Session extends Tokens {
  user: User
}

export const authApi = {
  login: (credentials: Credentials) =>
    request<Session>('/auth/login', { method: 'POST', body: credentials }),

  refresh: (refreshToken: string) =>
    request<Tokens>('/auth/refresh', { method: 'POST', body: { refreshToken }, skipRefresh: true }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),

  me: (options?: RequestOptions) => request<User>('/me', options),
}

/**
 * 누가 로그인했는가. 세션은 서버가 진실이다.
 *
 * 클라이언트가 사용자를 따로 들고 있으면 토큰과 사용자가 두 곳에 있게 되고,
 * 토큰이 죽었을 때 한쪽만 낡는다. 401 이면 이 쿼리가 실패하고 화면이 로그인으로 간다.
 */
export const meQuery = () =>
  queryOptions({
    queryKey: queryKeys.me,
    // 401 을 받으면 요청 없이 null 로 비운다. 그래서 반환형이 nullable 이다.
    queryFn: (): Promise<User | null> => authApi.me(),
    retry: false,
  })

import { request, type RequestOptions } from './http'
import type {
  PointType,
  PointTypeId,
  Points,
  Transfer,
  TransferId,
  User,
  UserId,
  Wallet,
} from '@/domain/types'

// 화면은 이 함수들을 직접 부르지 않고 api/queries.ts 를 거친다.
export interface CreateTransferInput {
  pointTypeId: PointTypeId
  toId: UserId
  amount: Points
}

export interface HistoryQuery {
  /** 특정 포인트의 내역만 */
  pointTypeId?: PointTypeId
  limit?: number
}

export const endpoints = {
  me: (options?: RequestOptions) => request<User>('/me', options),

  /** 내가 가진 포인트별 잔액 전부 */
  wallet: (options?: RequestOptions) => request<Wallet>('/wallet', options),

  /** 발행 권한은 `issuerId` 로 판단한다. */
  pointTypes: (options?: RequestOptions) => request<PointType[]>('/point-types', options),

  users: (query?: string, options?: RequestOptions) =>
    request<User[]>('/users', { ...options, query: { q: query || undefined } }),

  /** 포인트마다 다르다. */
  recent: (pointTypeId: PointTypeId, limit?: number, options?: RequestOptions) =>
    request<User[]>('/recent', { ...options, query: { pointTypeId, limit } }),

  createTransfer: (input: CreateTransferInput, idempotencyKey: string) =>
    request<Transfer>('/transfers', { method: 'POST', body: input, idempotencyKey }),

  /** 발행. 해당 포인트의 발행자만 성공한다 */
  createIssue: (input: CreateTransferInput, idempotencyKey: string) =>
    request<Transfer>('/issues', { method: 'POST', body: input, idempotencyKey }),

  /** 결과를 알 수 없는 실패 뒤에 실제 상태를 확인할 때 */
  transfer: (id: TransferId, options?: RequestOptions) =>
    request<Transfer>(`/transfers/${id}`, options),

  history: (params: HistoryQuery = {}, options?: RequestOptions) =>
    request<Transfer[]>('/transfers', {
      ...options,
      query: { pointTypeId: params.pointTypeId, limit: params.limit },
    }),
}

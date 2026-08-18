import { request, type RequestOptions } from './http'
import type {
  HistoryEntry,
  PointAccent,
  PointType,
  PointTypeId,
  PointVisibility,
  Points,
  Transfer,
  TransferId,
  User,
  UserId,
  Wallet,
} from '@/api/contract'

// 화면은 이 함수들을 직접 부르지 않고 api/queries.ts 를 거친다.
export interface CreateTransferInput {
  pointTypeId: PointTypeId
  toId: UserId
  amount: Points
}

/** 발행은 자기 지갑으로만 한다 — docs/JOURNEY.md 여정 7 */
export interface CreateIssueInput {
  pointTypeId: PointTypeId
  amount: Points
}

/** 만든 사람이 발행자다 — 본문에 `issuerId` 가 없다. docs/JOURNEY.md 여정 9 */
export interface CreatePointTypeInput {
  name: string
  symbol: string
  accent: PointAccent
  issueCap: Points
  /** 나중에 바꿀 수 없다 — 계약: docs/API.md */
  visibility: PointVisibility
}

export interface HistoryQuery {
  /** 특정 포인트의 내역만 */
  pointTypeId?: PointTypeId
  limit?: number
}

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

export const endpoints = {
  login: (credentials: Credentials) =>
    request<Session>('/auth/login', { method: 'POST', body: credentials }),

  refresh: (refreshToken: string) =>
    request<Tokens>('/auth/refresh', { method: 'POST', body: { refreshToken }, skipRefresh: true }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),

  me: (options?: RequestOptions) => request<User>('/me', options),

  /** 내가 가진 포인트별 잔액 전부 */
  wallet: (options?: RequestOptions) => request<Wallet>('/wallet', options),

  /** 발행 권한은 `issuerId` 로 판단한다. */
  pointTypes: (options?: RequestOptions) => request<PointType[]>('/point-types', options),

  /** 은행 페이지. 내 지갑에 없는 포인트도 소개는 읽을 수 있다 */
  pointType: (pointTypeId: PointTypeId, options?: RequestOptions) =>
    request<PointType>(`/point-types/${pointTypeId}`, options),

  users: (query?: string, options?: RequestOptions) =>
    request<User[]>('/users', { ...options, query: { q: query || undefined } }),

  /** 포인트마다 다르다. */
  recent: (pointTypeId: PointTypeId, limit?: number, options?: RequestOptions) =>
    request<User[]>('/recent', { ...options, query: { pointTypeId, limit } }),

  createTransfer: (input: CreateTransferInput, idempotencyKey: string) =>
    request<Transfer>('/transfers', { method: 'POST', body: input, idempotencyKey }),

  createPointType: (input: CreatePointTypeInput, idempotencyKey: string) =>
    request<PointType>('/point-types', { method: 'POST', body: input, idempotencyKey }),

  /** 발행. 해당 포인트의 발행자만 성공한다 */
  createIssue: (input: CreateIssueInput, idempotencyKey: string) =>
    request<Transfer>('/issues', { method: 'POST', body: input, idempotencyKey }),

  /** 상한 변경. 발행자만. 취소가 아니라 또 하나의 변경이다 — docs/API.md */
  changeCap: (pointTypeId: PointTypeId, issueCap: Points, idempotencyKey: string) =>
    request<PointType>(`/point-types/${pointTypeId}/cap`, {
      method: 'PATCH',
      body: { issueCap },
      idempotencyKey,
    }),

  transfer: (id: TransferId, options?: RequestOptions) =>
    request<Transfer>(`/transfers/${id}`, options),

  /**
   * 결과를 알 수 없는 실패 뒤에 "정말 안 일어났나" 를 확인한다.
   * 응답을 못 받은 클라이언트는 id 를 모르므로 키로 묻는다.
   */
  transferByKey: (idempotencyKey: string, options?: RequestOptions) =>
    request<Transfer | null>('/transfers/by-key', { ...options, query: { idempotencyKey } }),

  history: (params: HistoryQuery = {}, options?: RequestOptions) =>
    request<HistoryEntry[]>('/history', {
      ...options,
      query: { pointTypeId: params.pointTypeId, limit: params.limit },
    }),
}

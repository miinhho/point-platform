import { queryOptions } from '@tanstack/react-query'
import type {
  PointAccent,
  PointType,
  PointTypeId,
  PointVisibility,
  Points,
  User,
  UserId,
} from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

/** 만든 사람이 발행자다 — 본문에 `issuerId` 가 없다. docs/JOURNEY.md 여정 9 */
export interface CreatePointTypeInput {
  name: string
  emoji: string
  /** 없으면 `null` 이다. 빈 문자열로 보내지 않는다 */
  description: string | null
  accent: PointAccent
  issueCap: Points
  /** 나중에 바꿀 수 없다 — 계약: docs/API.md */
  visibility: PointVisibility
}

export const pointsApi = {
  /** 발행 권한은 `issuerId` 로 판단한다. */
  pointTypes: (options?: RequestOptions) => request<PointType[]>('/point-types', options),

  /** 은행 페이지. 내 지갑에 없는 포인트도 소개는 읽을 수 있다 */
  pointType: (pointTypeId: PointTypeId, options?: RequestOptions) =>
    request<PointType>(`/point-types/${pointTypeId}`, options),

  createPointType: (input: CreatePointTypeInput, idempotencyKey: string) =>
    request<PointType>('/point-types', { method: 'POST', body: input, idempotencyKey }),

  /** 상한 변경. 발행자만. 취소가 아니라 또 하나의 변경이다 — docs/API.md */
  changeCap: (pointTypeId: PointTypeId, issueCap: Points, idempotencyKey: string) =>
    request<PointType>(`/point-types/${pointTypeId}/cap`, {
      method: 'PATCH',
      body: { issueCap },
      idempotencyKey,
    }),

  /** 회원 목록. 회원만 읽는다 */
  members: (pointTypeId: PointTypeId, options?: RequestOptions) =>
    request<User[]>(`/point-types/${pointTypeId}/members`, options),

  /** 나간다. 잔액은 그대로 남고 쓸 수 없게 된다 — docs/API.md */
  leaveBank: (pointTypeId: PointTypeId) =>
    request<void>(`/point-types/${pointTypeId}/members/me`, { method: 'DELETE' }),

  /** 내보낸다. 은행장만. 나가기와 같은 일을 하고 누가 정했느냐만 다르다 */
  removeMember: (pointTypeId: PointTypeId, userId: UserId) =>
    request<void>(`/point-types/${pointTypeId}/members/${userId}`, { method: 'DELETE' }),
}

/** 은행 페이지가 읽는다. 지갑에 없는 포인트도 소개는 온다 — 계약: docs/API.md */
export const pointTypeQuery = (pointTypeId: PointTypeId) =>
  queryOptions({
    queryKey: queryKeys.pointType(pointTypeId),
    queryFn: (): Promise<PointType> => pointsApi.pointType(pointTypeId),
  })

/** 회원 목록. 회원만 읽는다 — 비공개 은행에만 있다 */
export const membersQuery = (pointTypeId: PointTypeId) =>
  queryOptions({
    queryKey: queryKeys.members(pointTypeId),
    queryFn: () => pointsApi.members(pointTypeId),
  })

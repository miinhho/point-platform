import { queryOptions } from '@tanstack/react-query'
import type { Invite, PointType, PointTypeId, UserId } from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

export const invitesApi = {
  /** 내가 받은 초대. 거절도 취소도 없다 — docs/API.md 「회원 자격」 */
  invites: (options?: RequestOptions) => request<Invite[]>('/invites', options),

  /** 초대. 은행장만. 같은 사람을 다시 초대하면 같은 초대가 온다 */
  createInvite: (pointTypeId: PointTypeId, userId: UserId, idempotencyKey: string) =>
    request<Invite>(`/point-types/${pointTypeId}/invites`, {
      method: 'POST',
      body: { userId },
      idempotencyKey,
    }),

  /** 수락하면 초대가 사라지고 회원이 된다 */
  acceptInvite: (inviteId: string) =>
    request<PointType>(`/invites/${inviteId}/accept`, { method: 'POST' }),
}

/** 내가 받은 초대. 수락하면 사라지므로 「초대가 있다」가 곧 「아직 회원이 아니다」다 */
export const invitesQuery = () =>
  queryOptions({ queryKey: queryKeys.invites, queryFn: () => invitesApi.invites() })

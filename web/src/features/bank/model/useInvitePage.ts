import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { invitesApi, newIdempotencyKey, usersQuery } from '@/shared/api'
import type { PointTypeId, User, UserId } from '@/shared/contract'

export interface InvitePageView {
  query: string
  setQuery: (value: string) => void
  pending: boolean
  failed: boolean
  retry: () => void
  /** 이미 회원인 사람은 빠져 있다 */
  candidates: User[]
  /** 이 화면에 머무는 동안 초대한 사람 */
  invited: ReadonlySet<UserId>
  busy: boolean
  invite: (userId: UserId) => void
}

/**
 * **이미 회원인 사람은 후보에서 뺀다.** 초대할 수 없는 사람을 눌러 볼 수 있게 두면
 * 정상 경로에서 `ALREADY_MEMBER` 를 만나게 된다 — 그건 겹쳐 들어온 경우에만 나오는
 * 막다른 답이다. 계약: docs/API.md
 */
export function useInvitePage(pointTypeId: PointTypeId): InvitePageView {
  const [query, setQuery] = useState('')
  const [invited, setInvited] = useState<ReadonlySet<UserId>>(new Set())

  const everyone = useQuery(usersQuery(query.trim()))
  // 회원 판정은 서버가 한다. 화면은 그 답으로 후보를 거를 뿐이다.
  const members = useQuery(usersQuery('', pointTypeId))
  const memberIds = new Set(members.data?.map((user) => user.id))

  const invite = useMutation({
    mutationFn: (toId: UserId) => invitesApi.createInvite(pointTypeId, toId, newIdempotencyKey()),
    retry: false,
    // 보낸 초대를 되읽는 길이 계약에 없다. 이 화면에 머무는 동안만 기억한다.
    onSuccess: (_created, toId) => setInvited((previous) => new Set([...previous, toId])),
  })

  return {
    query,
    setQuery,
    pending: everyone.isPending,
    failed: everyone.isError,
    retry: () => void everyone.refetch(),
    candidates: (everyone.data ?? []).filter((user) => !memberIds.has(user.id)),
    invited,
    busy: invite.isPending,
    invite: (userId) => invite.mutate(userId),
  }
}

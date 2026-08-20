import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { invitesApi, newIdempotencyKey, read, usersQuery } from '@/shared/api'
import type { PointTypeId, User, UserId } from '@/shared/contract'

export interface InvitePageView {
  query: string
  setQuery: (value: string) => void
  pending: boolean
  failed: boolean
  retry: () => void
  /** 이미 회원인 사람은 빠져 있다. 거르지 못했으면 비어 있다 */
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

  // 전역 검색이다. 이체의 받는 사람 고르기와 같은 목록이라 아무나 부를 수 있다.
  const everyone = read(useQuery(usersQuery(query.trim())))
  // 회원 판정은 서버가 한다. 화면은 그 답으로 후보를 거를 뿐이다.
  const members = read(useQuery(usersQuery('', pointTypeId)))
  const memberIds = new Set(members.data?.map((user) => user.id))

  const invite = useMutation({
    mutationFn: (toId: UserId) => invitesApi.createInvite(pointTypeId, toId, newIdempotencyKey()),
    retry: false,
    // 보낸 초대를 되읽는 길이 계약에 없다. 이 화면에 머무는 동안만 기억한다.
    onSuccess: (_created, toId) => setInvited((previous) => new Set([...previous, toId])),
  })

  /*
   * **거르지 못한 목록을 보여주지 않는다.** 회원 조회가 실패하면 `memberIds` 가 비고,
   * 그러면 아무도 안 걸러진 목록이 「초대할 수 있는 사람들」로 보인다 — 못 불러온 것이
   * 「회원이 없다」로 읽히는 자리다. 그 목록에서 고른 사람은 `ALREADY_MEMBER` 라는
   * 막다른 답을 만나고, 후보에서 회원을 빼는 것이 바로 그것을 막으려던 것이다.
   * 규칙: CLAUDE.md · 계약: docs/API.md
   */
  const filtered = members.data !== null

  return {
    query,
    setQuery,
    pending: everyone.pending || members.pending,
    failed: everyone.failed || members.failed,
    retry: () => {
      everyone.retry()
      members.retry()
    },
    candidates: filtered
      ? (everyone.data ?? []).filter((user) => !memberIds.has(user.id))
      : [],
    invited,
    busy: invite.isPending,
    invite: (userId) => invite.mutate(userId),
  }
}

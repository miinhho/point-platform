import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  invitesApi,
  invitesQuery,
  membersQuery,
  pointTypeQuery,
  queryKeys,
  walletQuery,
} from '@/shared/api'
import type { Balance, Invite, PointType, PointTypeId, User } from '@/shared/contract'

/** 은행 페이지가 그리는 것 전부. 화면은 이 값만 읽는다 */
export interface BankPageView {
  pending: boolean
  failed: boolean
  retry: () => void
  pointType: PointType | null
  /** 내 잔액. 없으면 이 포인트를 갖고 있지 않다 */
  balance: Balance | null
  /** 나. 발행이 자기 지갑으로 들어가므로 필요하다 */
  me: User | null
  /** 내 앞으로 온 초대. 수락하면 사라지므로 있으면 아직 회원이 아니다 */
  invite: Invite | null
  isPrivate: boolean
  /** 비공개 은행인데 회원이 아니다 */
  outside: boolean
}

/**
 * 은행 페이지가 무엇을 아는가.
 *
 * 조회 넷과 그 조합을 화면에서 걷어낸다 — 「회원인가」처럼 서버의 답을 읽어야
 * 하는 판단이 JSX 사이에 있으면 화면을 고칠 때마다 그것을 다시 읽게 된다.
 */
export function useBankPage(pointTypeId: PointTypeId): BankPageView {
  const bank = useQuery(pointTypeQuery(pointTypeId))
  const wallet = useQuery(walletQuery())
  const invites = useQuery(invitesQuery())

  const pointType = bank.data ?? null
  const invite = invites.data?.find((candidate) => candidate.pointType.id === pointTypeId) ?? null
  const isPrivate = pointType?.visibility === 'private'

  /*
   * 회원인가. 회원 목록이 회원에게만 열린다는 것이 서버의 판정이라 그것을 읽는다 —
   * `sendable === 0` 에서 되짚으면 보류금과 구별되지 않고, 그건 규칙을 화면이 다시
   * 계산하는 것이다. 계약: docs/API.md 「회원 자격」
   */
  const members = useQuery({
    ...membersQuery(pointTypeId),
    enabled: isPrivate && !invite,
    retry: false,
  })

  /*
   * 명부는 셋으로 답한다. 「회원이 아니다」는 서버가 `NOT_MEMBER` 로 말했을 때만이다 —
   * 아무 오류나 그렇게 읽으면 경로가 없거나 서버가 넘어졌을 때 회원에게
   * 「회원이 아니에요」라고 말한다. 관측: docs/FIELD.md W7
   */
  const outside =
    isPrivate && !invite && members.error instanceof ApiError && members.error.code === 'NOT_MEMBER'

  return {
    pending: bank.isPending,
    failed: bank.isError,
    retry: () => void bank.refetch(),
    pointType,
    balance: wallet.data?.balances.find((b) => b.pointType.id === pointTypeId) ?? null,
    me: wallet.data?.user ?? null,
    invite,
    isPrivate,
    outside,
  }
}

/**
 * 가입. 되돌릴 수 있으므로 꾹 누르게 만들지 않는다 — 되돌릴 수 없는 것은 그 안에서
 * 주고받은 것이지 소속이 아니다. 근거: docs/JOURNEY.md 여정 10
 */
export function useJoinBank(pointTypeId: PointTypeId, inviteId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () => invitesApi.acceptInvite(inviteId),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.invites })
      void client.invalidateQueries({ queryKey: queryKeys.pointType(pointTypeId) })
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
    },
  })
}

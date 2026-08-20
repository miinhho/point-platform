import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invitesApi, invitesQuery, pointTypeQuery, queryKeys, walletQuery } from '@/shared/api'
import type { Balance, PointType, PointTypeId, User } from '@/shared/contract'

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
  /**
   * 수락할 초대의 id. `membership === 'invited'` 일 때만 있다.
   *
   * 「초대받았는가」는 `membership` 이 답한다. 그런데 수락은 초대 id 로만 되므로
   * (`POST /api/invites/:id/accept`) id 를 얻으려고 그때만 한 번 더 묻는다.
   */
  inviteId: string | null
  isPrivate: boolean
  /** 비공개 은행인데 회원도 초대받은 사람도 아니다 */
  outside: boolean
}

/**
 * 은행 페이지가 무엇을 아는가.
 *
 * 나와 이 은행의 관계는 서버가 `membership` 으로 실어 준다 — 계약: docs/API.md.
 * 화면도 이 훅도 그것을 다시 계산하지 않는다.
 */
export function useBankPage(pointTypeId: PointTypeId): BankPageView {
  const bank = useQuery(pointTypeQuery(pointTypeId))
  const wallet = useQuery(walletQuery())

  const pointType = bank.data ?? null
  const membership = pointType?.membership ?? null

  // 수락에 필요한 id 만 얻는다. 초대받았는지는 이미 `membership` 이 답했다.
  const invites = useQuery({ ...invitesQuery(), enabled: membership === 'invited' })

  return {
    pending: bank.isPending,
    failed: bank.isError,
    retry: () => void bank.refetch(),
    pointType,
    balance: wallet.data?.balances.find((b) => b.pointType.id === pointTypeId) ?? null,
    me: wallet.data?.user ?? null,
    inviteId:
      invites.data?.find((candidate) => candidate.pointType.id === pointTypeId)?.id ?? null,
    isPrivate: pointType?.visibility === 'private',
    outside: membership === 'outsider',
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invitesApi, pointTypeQuery, queryKeys, read, walletQuery } from '@/shared/api'
import type { Balance, PointType, PointTypeId, User } from '@/shared/contract'

/** 은행 페이지가 그리는 것 전부. 화면은 이 값만 읽는다 */
export interface BankPageView {
  pending: boolean
  failed: boolean
  /** 이 은행은 나에게 없다는 **답**을 받았다 */
  absent: boolean
  retry: () => void
  pointType: PointType | null
  /** 내 잔액. 없으면 이 포인트를 갖고 있지 않다 */
  balance: Balance | null
  /** 나. 발행이 자기 지갑으로 들어가므로 필요하다 */
  me: User | null
  /** 아직 회원이 아니고 초대가 살아 있다 */
  invited: boolean
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
  const bank = read(useQuery(pointTypeQuery(pointTypeId)))
  const wallet = read(useQuery(walletQuery()))

  const pointType = bank.data
  const membership = pointType?.membership ?? null

  return {
    pending: bank.pending,
    failed: bank.failed,
    absent: bank.absent,
    retry: bank.retry,
    pointType,
    balance: wallet.data?.balances.find((b) => b.pointType.id === pointTypeId) ?? null,
    me: wallet.data?.user ?? null,
    invited: membership === 'invited',
    isPrivate: pointType?.visibility === 'private',
    outside: membership === 'outsider',
  }
}

/**
 * 가입. 되돌릴 수 있으므로 꾹 누르게 만들지 않는다 — 되돌릴 수 없는 것은 그 안에서
 * 주고받은 것이지 소속이 아니다. 근거: docs/JOURNEY.md 여정 10
 */
export function useJoinBank(pointTypeId: PointTypeId) {
  const client = useQueryClient()

  return useMutation({
    // 초대 id 를 쥐지 않는다. 소진되면 새것이 나므로 화면이 붙들면 낡는다
    mutationFn: () => invitesApi.acceptInvite(pointTypeId),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.invites })
      void client.invalidateQueries({ queryKey: queryKeys.pointType(pointTypeId) })
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, membersQuery, pointTypeQuery, pointsApi, queryKeys } from '@/shared/api'
import type { PointType, PointTypeId, User, UserId } from '@/shared/contract'

export interface MembersPageView {
  /** 명부 조회 */
  pending: boolean
  failed: boolean
  retry: () => void
  /**
   * 은행 조회. **명부와 따로 다룬다** — 이 화면은 주소로 바로 열 수 있으므로 은행이
   * 캐시에 있다고 가정할 수 없다. 못 불러온 것을 빈 화면으로 두면 「없다」로 읽힌다.
   */
  bankPending: boolean
  bankFailed: boolean
  retryBank: () => void
  pointType: PointType | null
  members: User[]
  /** 내보내기나 나가기가 거절당했다. 둘 중 나중 것이 화면에 남는다 */
  error: ApiError | null
  /** 요청이 나가는 중. 같은 사람을 두 번 내보내지 않는다 */
  busy: boolean
  remove: (userId: UserId) => void
  leave: () => void
}

/**
 * 나가기와 내보내기가 한 화면에 있다 — 둘은 같은 일을 하고 누가 정했느냐만 다르다.
 * 그래서 무효화도 같고, 여기 함께 둔다. 계약: docs/API.md 「회원 자격」
 */
export function useMembersPage(pointTypeId: PointTypeId, onLeft: () => void): MembersPageView {
  const client = useQueryClient()
  const bank = useQuery(pointTypeQuery(pointTypeId))
  const list = useQuery(membersQuery(pointTypeId))

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.members(pointTypeId) })
    void client.invalidateQueries({ queryKey: queryKeys.pointType(pointTypeId) })
    void client.invalidateQueries({ queryKey: queryKeys.wallet })
  }

  const remove = useMutation({
    mutationFn: (userId: UserId) => pointsApi.removeMember(pointTypeId, userId),
    retry: false,
    onSuccess: invalidate,
  })

  const leave = useMutation({
    mutationFn: () => pointsApi.leaveBank(pointTypeId),
    retry: false,
    onSuccess: () => {
      invalidate()
      onLeft()
    },
  })

  return {
    pending: list.isPending,
    failed: list.isError,
    retry: () => void list.refetch(),
    bankPending: bank.isPending,
    bankFailed: bank.isError,
    retryBank: () => void bank.refetch(),
    pointType: bank.data ?? null,
    members: list.data ?? [],
    error:
      [remove.error, leave.error].find(
        (candidate): candidate is ApiError => candidate instanceof ApiError,
      ) ?? null,
    busy: remove.isPending || leave.isPending,
    remove: (userId) => remove.mutate(userId),
    leave: () => leave.mutate(),
  }
}

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { endpoints, type CreateTransferInput } from './endpoints'
import type { PointTypeId, Transfer, TransferKind } from '@/domain/types'

/**
 * 서버 상태.
 *
 * TanStack Query 가 담당하는 것과 Jotai 가 담당하는 것을 섞지 않는다.
 * 여기 있는 것은 전부 **서버가 진실인 값**이다 — 잔액, 사용자, 포인트 종류, 내역.
 * 화면이 그 값을 `useState` 에 복사해 두면 그 순간부터 두 개의 진실이 생긴다.
 *
 * 1차 구현은 `App.tsx` 의 `useState` 하나에 잔액을 담고 `reloadToken` 이라는
 * 손으로 만든 숫자로 무효화했다. 그 방식은 "언제 다시 읽어야 하는가"를 화면마다
 * 다시 판단하게 만들고, 실제로 주석과 동작이 어긋났다.
 */
export const queryKeys = {
  me: ['me'] as const,
  wallet: ['wallet'] as const,
  pointTypes: ['point-types'] as const,
  users: (query: string) => ['users', query] as const,
  recent: (pointTypeId: PointTypeId) => ['recent', pointTypeId] as const,
  history: (pointTypeId: PointTypeId | null) => ['history', pointTypeId] as const,
}

export const meQuery = () => queryOptions({ queryKey: queryKeys.me, queryFn: () => endpoints.me() })

export const walletQuery = () =>
  queryOptions({ queryKey: queryKeys.wallet, queryFn: () => endpoints.wallet() })

export const pointTypesQuery = () =>
  queryOptions({
    queryKey: queryKeys.pointTypes,
    queryFn: () => endpoints.pointTypes(),
    // 포인트 종류는 자주 바뀌지 않는다. 발행이 유통량을 바꾸므로 그때 무효화한다.
    staleTime: 5 * 60 * 1000,
  })

export const usersQuery = (query: string) =>
  queryOptions({
    queryKey: queryKeys.users(query),
    queryFn: () => endpoints.users(query),
    // 글자를 칠 때마다 목록이 비었다가 차면 찾던 사람이 사라진 것처럼 보인다.
    placeholderData: (previous) => previous,
  })

export const recentQuery = (pointTypeId: PointTypeId) =>
  queryOptions({
    queryKey: queryKeys.recent(pointTypeId),
    queryFn: () => endpoints.recent(pointTypeId),
  })

export const historyQuery = (pointTypeId: PointTypeId | null) =>
  queryOptions({
    queryKey: queryKeys.history(pointTypeId),
    queryFn: () => endpoints.history(pointTypeId ? { pointTypeId } : {}),
  })

export interface SubmitVariables {
  kind: TransferKind
  input: CreateTransferInput
  /**
   * 확정 화면에 들어갈 때 만든 키.
   *
   * 뮤테이션이 만들지 않는다. 재시도가 **같은 키**를 다시 써야 하는데, 뮤테이션이
   * 매번 만들면 재시도가 새 이체가 된다 — 이중 이체를 막는 것은 이 키뿐이다.
   */
  idempotencyKey: string
}

/**
 * 보내기 · 발행.
 *
 * 성공하면 서버가 바꾼 것들을 무효화한다. 낙관적 업데이트를 쓰지 않는다 —
 * 송금은 그것을 쓰면 안 되는 대표 사례다. 태스크 앱에서는 친절함이지만
 * 여기서는 거짓 완료가 된다.
 */
export function useSubmitTransfer(): UseMutationResult<Transfer, Error, SubmitVariables> {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ kind, input, idempotencyKey }: SubmitVariables) =>
      kind === 'issue'
        ? endpoints.createIssue(input, idempotencyKey)
        : endpoints.createTransfer(input, idempotencyKey),

    // 결과를 알 수 없는 실패(NETWORK·SERVER)에서 자동 재시도를 켜지 않는다.
    // 멱등성 키가 있어 안전하긴 하지만, 재시도는 사용자가 화면을 보고 내리는
    // 결정이어야 한다 — 조용히 다시 보내면 사용자는 몇 번 시도됐는지 모른다.
    retry: false,

    onSuccess: (transfer) => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      void client.invalidateQueries({ queryKey: queryKeys.recent(transfer.pointTypeId) })
      void client.invalidateQueries({ queryKey: ['history'] })
      // 발행은 총 유통량을 바꾼다
      if (transfer.kind === 'issue') {
        void client.invalidateQueries({ queryKey: queryKeys.pointTypes })
      }
    },
  })
}

/** 결과를 알 수 없는 실패 뒤에 "정말 안 일어났나"를 확인할 때만 쓴다. */
export function useTransferLookup(id: string | null) {
  return useQuery({
    queryKey: ['transfer', id],
    queryFn: () => endpoints.transfer(id!),
    enabled: id !== null,
    retry: false,
  })
}

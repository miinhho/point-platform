import {
  queryOptions,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import type { PointTypeId, Transfer, TransferKind, User } from '@/api/contract'
import { endpoints, type CreateTransferInput } from './endpoints'

export const queryKeys = {
  me: ['me'] as const,
  wallet: ['wallet'] as const,
  users: (query: string) => ['users', query] as const,
  recent: (pointTypeId: PointTypeId) => ['recent', pointTypeId] as const,
  history: ['history'] as const,
}

/**
 * 누가 로그인했는가. 세션은 서버가 진실이다.
 *
 * 클라이언트가 사용자를 따로 들고 있으면 토큰과 사용자가 두 곳에 있게 되고,
 * 토큰이 죽었을 때 한쪽만 낡는다. 401 이면 이 쿼리가 실패하고 화면이 로그인으로 간다.
 */
export const meQuery = () =>
  queryOptions({
    queryKey: queryKeys.me,
    // 401 을 받으면 요청 없이 null 로 비운다. 그래서 반환형이 nullable 이다.
    queryFn: (): Promise<User | null> => endpoints.me(),
    retry: false,
  })

export const walletQuery = () =>
  queryOptions({ queryKey: queryKeys.wallet, queryFn: () => endpoints.wallet() })

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

export const historyQuery = () =>
  queryOptions({ queryKey: queryKeys.history, queryFn: () => endpoints.history() })

export interface SubmitVariables {
  kind: TransferKind
  input: CreateTransferInput
  /** 확정 화면에서 만든 키. 뮤테이션이 만들지 않는다 — 재시도가 같은 키여야 한다 */
  idempotencyKey: string
}

/** 낙관적 업데이트를 쓰지 않는다. 송금에서 그것은 거짓 완료가 된다. */
export function useSubmitTransfer(): UseMutationResult<Transfer, Error, SubmitVariables> {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ kind, input, idempotencyKey }: SubmitVariables) =>
      kind === 'issue'
        ? endpoints.createIssue(
            { pointTypeId: input.pointTypeId, amount: input.amount },
            idempotencyKey,
          )
        : endpoints.createTransfer(input, idempotencyKey),

    // 재시도는 사용자가 화면을 보고 내리는 결정이어야 한다.
    retry: false,

    onSuccess: (transfer) => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      void client.invalidateQueries({ queryKey: queryKeys.recent(transfer.pointTypeId) })
      void client.invalidateQueries({ queryKey: queryKeys.history })
    },
  })
}

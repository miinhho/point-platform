import { useCallback } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import {
  ApiError,
  issuesApi,
  queryKeys,
  transfersApi,
  type CreateTransferInput,
} from '@/shared/api'
import type { Failure, Issue, Transfer } from '@/shared/contract'
import { draftAtom, failAtom, succeedAtom } from './atoms'
import { amountOf, type DraftKind } from './draft'

export interface SubmitVariables {
  kind: DraftKind
  input: CreateTransferInput
  /** 확정 화면에서 만든 키. 뮤테이션이 만들지 않는다 — 재시도가 같은 키여야 한다 */
  idempotencyKey: string
}

/**
 * 확정. **낙관적 업데이트를 쓰지 않는다** — 송금에서 그것은 거짓 완료가 된다.
 *
 * 엔티티가 아니라 이 흐름의 것이라 `shared/api` 가 아니라 여기 있다. 무엇을 무효화할지
 * 아는 것도 이 흐름뿐이다.
 */
function useSubmitMutation(): UseMutationResult<Transfer | Issue, Error, SubmitVariables> {
  const client = useQueryClient()

  return useMutation<Transfer | Issue, Error, SubmitVariables>({
    // 계약에서는 둘이 다른 타입이다. 흐름이 갈릴 때까지 여기서만 함께 다룬다.
    mutationFn: ({ kind, input, idempotencyKey }: SubmitVariables) =>
      kind === 'issue'
        ? issuesApi.createIssue(
            { pointTypeId: input.pointTypeId, amount: input.amount },
            idempotencyKey,
          )
        : transfersApi.createTransfer(input, idempotencyKey),

    // 재시도는 사용자가 화면을 보고 내리는 결정이어야 한다.
    retry: false,

    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      void client.invalidateQueries({ queryKey: queryKeys.recent(result.pointTypeId) })
      void client.invalidateQueries({ queryKey: queryKeys.history })
    },
  })
}

function toFailure(error: unknown): Failure {
  if (error instanceof ApiError) {
    return { code: error.code, outcome: error.outcome, message: error.message }
  }
  // 클라이언트에서 터진 것은 서버가 무엇을 했는지 말해 주지 않는다. 단정하지 않는다.
  return { code: 'SERVER', outcome: 'unknown', message: '' }
}

/** 확정과 확인. 근거: docs/JOURNEY.md 여정 5·6 */
export function useSubmit() {
  const draft = useAtomValue(draftAtom)
  const succeed = useSetAtom(succeedAtom)
  const fail = useSetAtom(failAtom)
  const mutation = useSubmitMutation()

  const submit = useCallback(() => {
    if (!draft?.to || !draft.idempotencyKey || mutation.isPending) return
    mutation.mutate(
      {
        kind: draft.kind,
        input: {
          pointTypeId: draft.pointType.id,
          toId: draft.to.id,
          amount: amountOf(draft),
        },
        idempotencyKey: draft.idempotencyKey,
      },
      {
        onSuccess: (transfer) => succeed(transfer),
        onError: (error) => fail(toFailure(error)),
      },
    )
  }, [draft, mutation, succeed, fail])

  /**
   * 결과를 모를 때 누르는 것. 재시도가 아니라 조회다.
   * 이미 일어났으면 완료로 가고, 안 일어났으면 그때 보낸다.
   */
  const check = useCallback(() => {
    const key = draft?.idempotencyKey
    if (!key) return
    void transfersApi
      .transferByKey(key)
      .then((transfer) => (transfer ? succeed(transfer) : submit()))
      .catch((error: unknown) => fail(toFailure(error)))
  }, [draft, succeed, submit, fail])

  return { submit, check, busy: mutation.isPending }
}

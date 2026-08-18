import { useCallback } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { ApiError } from '@/api/http'
import { endpoints } from '@/api/endpoints'
import { useSubmitTransfer } from '@/api/queries'
import type { Failure } from '@/domain/types'
import { draftAtom, failAtom, succeedAtom } from './atoms'
import { amountOf } from './draft'

function toFailure(error: unknown): Failure {
  if (error instanceof ApiError) return { code: error.code, message: error.message }
  return { code: 'SERVER', message: '' }
}

/** 확정과 확인. 근거: docs/JOURNEY.md 여정 5·6 */
export function useSubmit() {
  const draft = useAtomValue(draftAtom)
  const succeed = useSetAtom(succeedAtom)
  const fail = useSetAtom(failAtom)
  const mutation = useSubmitTransfer()

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
    void endpoints
      .transferByKey(key)
      .then((transfer) => (transfer ? succeed(transfer) : submit()))
      .catch((error: unknown) => fail(toFailure(error)))
  }, [draft, succeed, submit, fail])

  return { submit, check, busy: mutation.isPending }
}

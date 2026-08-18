import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/contract'
import { mockApi } from '@/api/mock'
import type { Failure } from '@/domain/types'
import type { FlowAction, FlowState } from './transferFlow'

/**
 * 상태 기계와 서버 사이.
 *
 * 리듀서는 순수하게 두고, 서버와 이야기하는 일은 전부 여기 모은다. 화면이 각자
 * API 를 부르면 "누가 확정을 정하는가"가 흩어지고, 그러면 여정 5 의 규칙 —
 * **서버가 알려준 것만 표시한다** — 을 지킬 수 없다.
 */
function toFailure(error: unknown): Failure {
  if (error instanceof ApiError) return { code: error.code, message: error.message }
  return { code: 'SERVER', message: '알 수 없는 오류' }
}

export interface FlowRunner {
  /** 확정 화면의 홀드가 끝났을 때 */
  submit: () => void
  /** 취소 창 안에서만 성공한다 */
  cancel: () => void
  /** 요청이 나가는 중. 홀드를 두 번 완료해도 두 번 보내지 않는다 */
  busy: boolean
}

export function useFlowRunner(flow: FlowState, dispatch: (action: FlowAction) => void): FlowRunner {
  const [busy, setBusy] = useState(false)

  const submit = useCallback(() => {
    if (flow.step !== 'confirm' || busy) return
    const { kind, to, amount, idempotencyKey } = flow.draft
    const input = { idempotencyKey, toId: to.id, amount }

    setBusy(true)
    const request = kind === 'issue' ? mockApi.createIssue(input) : mockApi.createTransfer(input)
    void request
      .then((transfer) => dispatch({ type: 'submitted', transfer }))
      // 여기서 실패하면 이체가 성립했는지 알 수 없을 수 있다(NETWORK·SERVER).
      // 추측하지 않고 실패 화면으로 넘긴다 — 같은 멱등성 키가 있으므로 재시도가 안전하다.
      .catch((error: unknown) => dispatch({ type: 'failed', failure: toFailure(error) }))
      .finally(() => setBusy(false))
  }, [flow, busy, dispatch])

  const cancel = useCallback(() => {
    if (flow.step !== 'sending') return
    const transferId = flow.transfer.id
    void mockApi
      .cancel(transferId)
      .then((transfer) => dispatch({ type: 'transferChanged', transfer }))
      .catch(() => {
        // 취소가 거절됐다. 이유를 추측하지 말고 서버에 지금 상태를 다시 묻는다.
        void mockApi
          .get(transferId)
          .then((transfer) => dispatch({ type: 'transferChanged', transfer }))
          .catch(() => undefined)
      })
  }, [flow, dispatch])

  /**
   * 확정을 서버에서 받아온다.
   *
   * 클라이언트가 타이머로 "이제 됐겠지" 하고 완료를 표시하면 그건 거짓 완료다.
   * 사용자는 끝났다고 믿고 화면을 떠난다.
   */
  const watchedId = flow.step === 'sending' ? flow.transfer.id : null
  useEffect(() => {
    if (!watchedId) return
    return mockApi.watch(watchedId, (transfer) => dispatch({ type: 'transferChanged', transfer }))
  }, [watchedId, dispatch])

  return { submit, cancel, busy }
}

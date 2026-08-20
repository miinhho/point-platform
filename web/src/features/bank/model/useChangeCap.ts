import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { ApiError, newIdempotencyKey, pointsApi, queryKeys } from '@/shared/api'
import { parseInput } from '@/shared/format'
import type { PointType, Points } from '@/shared/contract'

export interface ChangeCapForm {
  cap: string
  setCap: (value: string) => void
  next: Points
  ready: boolean
  busy: boolean
  error: ApiError | null
  /** 바뀐 값은 위의 표에 나온다. 화면을 못 보는 사람에게는 이것이 닿는다 */
  changed: boolean
  submit: () => void
  /** 어디를 고쳐야 하는지 포커스로도 말한다 — 관측: docs/FIELD.md S9-5 */
  capInput: React.RefObject<HTMLInputElement | null>
}

/** 상한 변경. 취소가 아니라 또 하나의 변경이다 — docs/JOURNEY.md 여정 9 */
export function useChangeCap(pointType: PointType, onChanged: () => void): ChangeCapForm {
  const client = useQueryClient()
  const [cap, setCap] = useState('')
  const [changed, setChanged] = useState(false)
  const capInput = useRef<HTMLInputElement>(null)
  // 확정 직전에 만들지 않는다. 응답을 못 받고 다시 눌러도 이력에 두 줄이 생기면 안 된다.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const change = useMutation({
    mutationFn: (value: Points) => pointsApi.changeCap(pointType.id, value, idempotencyKey),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.pointType(pointType.id) })
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      void client.invalidateQueries({ queryKey: queryKeys.history })
      setCap('')
      setChanged(true)
      // 또 바꿀 수 있다. 키를 물려주면 두 번째가 첫 번째의 재시도가 된다.
      setIdempotencyKey(newIdempotencyKey())
      onChanged()
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === 'CAP_BELOW_ISSUED') {
        capInput.current?.focus()
      }
    },
  })

  const next = parseInput(cap)
  const error = change.error instanceof ApiError ? change.error : null

  return {
    cap,
    setCap: (value) => {
      setCap(value)
      setChanged(false)
      // 고친 값에 낡은 판정이 붙어 있으면 화면이 거짓을 말한다.
      if (error?.code === 'CAP_BELOW_ISSUED') change.reset()
    },
    next,
    // 같은 값은 이력에 아무것도 바꾸지 않는 줄을 만든다. 상한 판정 자체는 서버가 한다.
    ready: next > 0 && next !== pointType.issueCap,
    busy: change.isPending,
    error,
    changed,
    submit: () => change.mutate(next),
    capInput,
  }
}

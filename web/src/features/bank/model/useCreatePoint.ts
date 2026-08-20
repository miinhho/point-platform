import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, newIdempotencyKey, pointsApi, queryKeys } from '@/shared/api'
import { parseInput } from '@/shared/format'
import type { PointAccent, PointType, PointVisibility, Points } from '@/shared/contract'

export interface CreatePointForm {
  name: string
  setName: (value: string) => void
  emoji: string | null
  setEmoji: (value: string) => void
  description: string
  setDescription: (value: string) => void
  accent: PointAccent
  setAccent: (value: PointAccent) => void
  /** 고른 적 없음이 `null` 이다 — 기본값을 두면 비공개로 두려던 은행이 조용히 열린다 */
  visibility: PointVisibility | null
  setVisibility: (value: PointVisibility) => void
  cap: string
  setCap: (value: string) => void
  capAmount: Points
  ready: boolean
  busy: boolean
  error: ApiError | null
  submit: () => void
  /** 만들어진 것. 결과 화면은 주소를 갖지 않으므로 여기 남는다 */
  created: PointType | null
}

/** 근거: docs/JOURNEY.md 여정 9 */
export function useCreatePoint(): CreatePointForm {
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [accent, setAccent] = useState<PointAccent>('blue')
  const [visibility, setVisibility] = useState<PointVisibility | null>(null)
  const [cap, setCap] = useState('')
  const [created, setCreated] = useState<PointType | null>(null)

  // 확정 직전에 만들지 않는다. 응답을 못 받고 다시 눌러도 같은 키여야 한다.
  const [idempotencyKey] = useState(newIdempotencyKey)

  const create = useMutation({
    mutationFn: (chosen: PointVisibility) =>
      pointsApi.createPointType(
        {
          name: name.trim(),
          emoji: emoji!,
          // 「없음」은 `null` 하나다 — 빈 문자열을 보내지 않는다.
          description: description.trim() || null,
          accent,
          issueCap: parseInput(cap),
          visibility: chosen,
        },
        idempotencyKey,
      ),
    retry: false,
    onSuccess: (pointType) => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      setCreated(pointType)
    },
  })

  const capAmount = parseInput(cap)

  return {
    name,
    setName,
    emoji,
    setEmoji,
    description,
    setDescription,
    accent,
    setAccent,
    visibility,
    setVisibility,
    cap,
    setCap,
    capAmount,
    ready: name.trim() !== '' && emoji !== null && capAmount > 0 && visibility !== null,
    busy: create.isPending,
    error: create.error instanceof ApiError ? create.error : null,
    submit: () => visibility && create.mutate(visibility),
    created,
  }
}

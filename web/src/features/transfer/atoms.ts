import { atom } from 'jotai'
import { newIdempotencyKey } from '@/api/http'
import { goAtom, leaveFlowAtom, navAtom } from '@/app/atoms'
import { popTo } from '@/app/navigation'
import type { Failure, PointType, TransferKind, User } from '@/domain/types'
import {
  appendDigit,
  clearAmount,
  removeDigit,
  seal,
  startDraft,
  withRecipient,
  type Draft,
} from './draft'

// 초안과 내비게이션을 여기서 묶는다. 쓰기 아톰 하나가 곧 사용자 행동 하나다.
export const draftAtom = atom<Draft | null>(null)

/** 마지막 실패. 실패 화면이 읽고, 재시도하거나 떠날 때 지운다 */
export const failureAtom = atom<Failure | null>(null)

export interface StartInput {
  pointType: PointType
  kind?: TransferKind
  /** 주어지면 대상 선택을 건너뛴다. */
  to?: User
}

/** 대상이 정해져 있으면 금액 화면으로 직행한다. */
export const startTransferAtom = atom(null, (_get, set, input: StartInput) => {
  const draft = startDraft(input.pointType, input.kind ?? 'transfer')
  set(draftAtom, input.to ? withRecipient(draft, input.to) : draft)
  set(failureAtom, null)
  set(goAtom, input.to ? { name: 'enterAmount' } : { name: 'pickRecipient' })
})

export const pickRecipientAtom = atom(null, (get, set, to: User) => {
  const draft = get(draftAtom)
  if (!draft) return
  set(draftAtom, withRecipient(draft, to))
  set(goAtom, { name: 'enterAmount' })
})

export const digitAtom = atom(null, (get, set, digit: string) => {
  const draft = get(draftAtom)
  if (draft) set(draftAtom, appendDigit(draft, digit))
})

export const backspaceAtom = atom(null, (get, set) => {
  const draft = get(draftAtom)
  if (draft) set(draftAtom, removeDigit(draft))
})

export const clearAmountAtom = atom(null, (get, set) => {
  const draft = get(draftAtom)
  if (draft) set(draftAtom, clearAmount(draft))
})

/** 확정 화면으로. 여기서 멱등성 키가 생긴다 */
export const toConfirmAtom = atom(null, (get, set) => {
  const draft = get(draftAtom)
  if (!draft?.to) return
  set(draftAtom, seal(draft, newIdempotencyKey))
  set(goAtom, { name: 'confirm' })
})

/** 초안을 버리지 않는다. 재시도가 같은 멱등성 키를 쓸 수 있어야 한다. */
export const failAtom = atom(null, (_get, set, failure: Failure) => {
  set(failureAtom, failure)
  set(goAtom, { name: 'failure' })
})

/** 실패 화면에서 다시 시도. 확정 화면으로 돌아간다 — 키는 그대로다 */
export const retryAtom = atom(null, (get, set) => {
  set(failureAtom, null)
  set(navAtom, popTo(get(navAtom), 'confirm'))
})

/** 금액을 고치러 돌아간다. 키가 버려지는 것은 `draft` 가 정한다 */
export const editAmountAtom = atom(null, (get, set) => {
  set(failureAtom, null)
  set(navAtom, popTo(get(navAtom), 'enterAmount'))
})

export const endFlowAtom = atom(null, (_get, set) => {
  set(draftAtom, null)
  set(failureAtom, null)
  set(leaveFlowAtom)
})

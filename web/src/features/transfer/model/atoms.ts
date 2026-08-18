import { atom } from 'jotai'
import { newIdempotencyKey } from '@/api/http'
import { goAtom, leaveFlowAtom, navAtom } from '@/app/atoms'
import { currentScreen, popTo } from '@/app/navigation'
import type { Failure, PointType, Transfer, TransferKind, User } from '@/api/contract'
import { seal, startDraft, withRecipient, type Draft } from './draft'

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

/** 발행. 대상은 나 자신이므로 대상 선택이 없다 — docs/JOURNEY.md 여정 7 */
export const startIssueAtom = atom(null, (_get, set, input: { pointType: PointType; me: User }) => {
  set(draftAtom, withRecipient(startDraft(input.pointType, 'issue'), input.me))
  set(failureAtom, null)
  set(goAtom, { name: 'enterAmount' })
})

export const pickRecipientAtom = atom(null, (get, set, to: User) => {
  const draft = get(draftAtom)
  if (!draft) return
  set(draftAtom, withRecipient(draft, to))
  set(goAtom, { name: 'enterAmount' })
})

/** 초안을 통째로 갈아 끼운다. 어떻게 바뀌는지는 `draft.ts` 의 순수 함수가 정한다 */
export const editDraftAtom = atom(null, (get, set, change: (draft: Draft) => Draft) => {
  const draft = get(draftAtom)
  if (draft) set(draftAtom, change(draft))
})

/** 확정 화면으로. 여기서 멱등성 키가 생긴다 */
export const toConfirmAtom = atom(null, (get, set) => {
  const draft = get(draftAtom)
  if (!draft?.to) return
  set(draftAtom, seal(draft, newIdempotencyKey))
  set(goAtom, { name: 'confirm' })
})

/** 초안을 버리지 않는다. 재시도가 같은 멱등성 키를 쓸 수 있어야 한다. */
export const failAtom = atom(null, (get, set, failure: Failure) => {
  set(failureAtom, failure)
  // 실패 화면에서 확인하다 또 실패하면 같은 화면이 자기 위에 쌓인다.
  if (currentScreen(get(navAtom))?.name === 'failure') return
  set(goAtom, { name: 'failure' })
})

/** 확정됨. 초안은 남겨 둔다 — 결과 화면이 무엇을 보냈는지 말해야 한다 */
export const succeedAtom = atom(null, (_get, set, transfer: Transfer) => {
  set(failureAtom, null)
  set(goAtom, { name: 'result', transfer })
})

/**
 * 받는 사람을 다시 고른다. 초안이 없으면 고를 대상 자체가 없으므로 플로우를 끝낸다.
 * 셸이 초안을 들여다보고 분기하면 이체를 아는 곳이 둘이 된다.
 */
export const repickAtom = atom(null, (get, set) => {
  const draft = get(draftAtom)
  if (!draft) {
    set(endFlowAtom)
    return
  }
  set(startTransferAtom, { pointType: draft.pointType, kind: draft.kind })
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

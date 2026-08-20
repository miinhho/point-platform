import { atom } from 'jotai'
import { newIdempotencyKey } from '@/shared/api'
import type { Failure, Issue, PointType, Transfer, User } from '@/shared/contract'
import {
  backToAmount,
  editAmount,
  fail,
  pickRecipient,
  repick,
  seal,
  startIssue,
  startTransfer,
  stepBack,
  succeed,
  type AddressedDraft,
  type FlowState,
} from './flow'

/**
 * 이체·발행 흐름 하나. 열려 있으면 화면을 덮는다.
 *
 * 라우트가 아니다 — 진행 중인 일은 주소를 갖지 않는다(docs/REBUILD.md 「주소」).
 * 그래서 여기 있고, 어디까지 왔는지도 이 값이 함께 안다.
 */
export const flowAtom = atom<FlowState | null>(null)

export const currentFlowAtom = atom((get) => get(flowAtom)?.current ?? null)

export interface StartInput {
  pointType: PointType
  /** 주어지면 대상 선택을 건너뛴다. */
  to?: User
}

export const startTransferAtom = atom(null, (_get, set, input: StartInput) => {
  set(flowAtom, startTransfer(input.pointType, input.to))
})

/** 발행. 대상은 나 자신이므로 대상 선택이 없다 — docs/JOURNEY.md 여정 7 */
export const startIssueAtom = atom(null, (_get, set, input: { pointType: PointType; me: User }) => {
  set(flowAtom, startIssue(input.pointType, input.me))
})

export const pickRecipientAtom = atom(null, (get, set, to: User) => {
  edit(get, set, (state) => pickRecipient(state, to))
})

export const editAmountAtom = atom(
  null,
  (get, set, change: (draft: AddressedDraft) => AddressedDraft) => {
    edit(get, set, (state) => editAmount(state, change))
  },
)

/** 확정 화면으로. 여기서 멱등성 키가 생긴다 */
export const toConfirmAtom = atom(null, (get, set) => {
  edit(get, set, (state) => seal(state, newIdempotencyKey))
})

export const succeedAtom = atom(null, (get, set, result: Transfer | Issue) => {
  edit(get, set, (state) => succeed(state, result))
})

export const failAtom = atom(null, (get, set, failure: Failure) => {
  edit(get, set, (state) => fail(state, failure))
})

/** 금액을 고치러 돌아간다 */
export const backToAmountAtom = atom(null, (get, set) => {
  edit(get, set, backToAmount)
})

/** 받는 사람을 다시 고른다 */
export const repickAtom = atom(null, (get, set) => {
  edit(get, set, repick)
})

/**
 * 시스템 back. 되돌릴 곳이 없으면 흐름이 닫히고 **라우트는 그대로다** — 은행
 * 페이지에서 시작한 이체를 물리면 은행 페이지로 돌아온다.
 *
 * @returns 흐름이 아직 열려 있는가
 */
export const flowBackAtom = atom(null, (get, set): boolean => {
  const state = get(flowAtom)
  if (!state) return false
  const next = stepBack(state)
  set(flowAtom, next)
  return next !== null
})

/**
 * 흐름을 닫는다. **어디로 가는지는 정하지 않는다** — 흐름은 자기가 어느 주소 위에
 * 떠 있었는지 모르고, 알면 feature 가 셸을 수입한다.
 */
export const endFlowAtom = atom(null, (_get, set) => {
  set(flowAtom, null)
})

type Getter = (atom: typeof flowAtom) => FlowState | null
type Setter = (atom: typeof flowAtom, value: FlowState | null) => void

function edit(get: Getter, set: Setter, change: (state: FlowState) => FlowState): void {
  const state = get(flowAtom)
  if (state) set(flowAtom, change(state))
}

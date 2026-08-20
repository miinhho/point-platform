import { parseInput } from '@/shared/format'
import type { Failure, Issue, PointType, Points, Transfer, User } from '@/shared/contract'

/**
 * 흐름이 둘을 함께 다루는 동안만 쓰는 구분. **계약의 타입이 아니다** — 계약에서는
 * 이체와 발행이 다른 타입이다(docs/API.md 「발행은 이체가 아니다」).
 */
export type FlowKind = 'transfer' | 'issue'

/** 키패드 입력 자릿수 상한. 한글 병기가 성립하는 범위 안이다 */
const MAX_AMOUNT_DIGITS = 13

/** 무엇을 · 누구에게 · 얼마 */
export interface Draft {
  kind: FlowKind
  pointType: PointType
  to: User | null
  /** 키패드가 만든 문자열. 숫자 변환은 읽을 때 한다. */
  raw: string
  /** 확정 화면 진입 시 생긴다. 금액·대상이 바뀌면 버린다. */
  idempotencyKey: string | null
}

/** 대상이 정해진 초안. 금액 화면부터는 이것만 온다 */
export interface AddressedDraft extends Draft {
  to: User
}

/** 키가 찍힌 초안. 확정 이후 화면은 이것만 온다 */
export interface SealedDraft extends AddressedDraft {
  idempotencyKey: string
}

/**
 * 흐름의 한 단계. **어디까지 왔는가와 무엇을 들고 있는가가 한 값이다.**
 *
 * 단계마다 초안의 타입이 다르다 — 금액 화면에는 대상이, 확정 이후에는 멱등성 키가
 * 반드시 있다. 그래서 화면이 없는 값을 방어할 일이 없다.
 */
export type Flow =
  | { step: 'pickRecipient'; draft: Draft }
  | { step: 'enterAmount'; draft: AddressedDraft }
  | { step: 'confirm'; draft: SealedDraft }
  | { step: 'result'; draft: SealedDraft; result: Transfer | Issue }
  | { step: 'failure'; draft: SealedDraft; failure: Failure }

/**
 * 흐름과 그 흐름이 지나온 길. 뒤로 가기가 **기억할 필드 없이** 길을 따른다 —
 * 대상 선택을 거쳐 왔는지 바로 금액으로 왔는지를 따로 적어 두지 않는다.
 */
export interface FlowState {
  current: Flow
  past: Flow[]
}

export function startTransfer(pointType: PointType, to?: User): FlowState {
  const draft: Draft = { kind: 'transfer', pointType, to: to ?? null, raw: '', idempotencyKey: null }
  return {
    current: to ? { step: 'enterAmount', draft: { ...draft, to } } : { step: 'pickRecipient', draft },
    past: [],
  }
}

/** 발행. 대상은 나 자신이므로 대상 선택이 없다 — docs/JOURNEY.md 여정 7 */
export function startIssue(pointType: PointType, me: User): FlowState {
  return {
    current: {
      step: 'enterAmount',
      draft: { kind: 'issue', pointType, to: me, raw: '', idempotencyKey: null },
    },
    past: [],
  }
}

export function amountOf(draft: Draft): Points {
  return parseInput(draft.raw)
}

/** 확정 화면까지 가서 거절당하지 않게 미리 막는다. 최종 판단은 서버가 한다. */
export function isReady(draft: Draft, ceiling: Points): boolean {
  const amount = amountOf(draft)
  return amount > 0 && amount <= ceiling
}

export function appendDigit<D extends Draft>(draft: D, digit: string): D {
  // "007" 이 되면 한글 표기가 흔들린다.
  if (draft.raw === '' && digit === '0') return draft
  if (draft.raw.length >= MAX_AMOUNT_DIGITS) return draft
  return { ...draft, raw: draft.raw + digit, idempotencyKey: null }
}

export function removeDigit<D extends Draft>(draft: D): D {
  return { ...draft, raw: draft.raw.slice(0, -1), idempotencyKey: null }
}

export function clearAmount<D extends Draft>(draft: D): D {
  return { ...draft, raw: '', idempotencyKey: null }
}

/** 대상을 고른다. 같은 키로 다른 사람에게 보내면 서버가 먼저 것을 돌려준다 */
export function pickRecipient(state: FlowState, to: User): FlowState {
  if (state.current.step !== 'pickRecipient') return state
  const draft = { ...state.current.draft, to, idempotencyKey: null }
  return go(state, { step: 'enterAmount', draft })
}

/** 금액을 고친다. 키가 버려지는 것은 `appendDigit` 들이 정한다 */
export function editAmount(
  state: FlowState,
  change: (draft: AddressedDraft) => AddressedDraft,
): FlowState {
  if (state.current.step !== 'enterAmount') return state
  return { ...state, current: { step: 'enterAmount', draft: change(state.current.draft) } }
}

/** 확정 화면으로. 여기서 멱등성 키가 생긴다 */
export function seal(state: FlowState, newKey: () => string): FlowState {
  if (state.current.step !== 'enterAmount') return state
  const { draft } = state.current
  return go(state, {
    step: 'confirm',
    draft: { ...draft, idempotencyKey: draft.idempotencyKey ?? newKey() },
  })
}

export function succeed(state: FlowState, result: Transfer | Issue): FlowState {
  const draft = sealedOf(state)
  return draft ? go(state, { step: 'result', draft, result }) : state
}

/** 초안을 버리지 않는다. 재시도가 같은 멱등성 키를 쓸 수 있어야 한다 */
export function fail(state: FlowState, failure: Failure): FlowState {
  const draft = sealedOf(state)
  if (!draft) return state
  // 실패 화면에서 확인하다 또 실패하면 같은 화면이 자기 위에 쌓인다.
  if (state.current.step === 'failure') {
    return { ...state, current: { step: 'failure', draft, failure } }
  }
  return go(state, { step: 'failure', draft, failure })
}

/** 금액을 고치러 돌아간다. 지나온 길에 그 화면이 있다 */
export function backToAmount(state: FlowState): FlowState {
  const index = state.past.findLastIndex((flow) => flow.step === 'enterAmount')
  if (index < 0) return state
  return { current: state.past[index], past: state.past.slice(0, index) }
}

/** 받는 사람을 다시 고른다. 발행에는 이 길이 없다 */
export function repick(state: FlowState): FlowState {
  const index = state.past.findIndex((flow) => flow.step === 'pickRecipient')
  if (index < 0) return state
  return { current: state.past[index], past: state.past.slice(0, index) }
}

/**
 * 한 단계 뒤로. 되돌릴 곳이 없으면 `null` — 흐름이 끝난다는 뜻이다.
 *
 * 끝난 뒤의 back 은 흐름 안으로 되돌아가는 것이 아니다. 확정된 이체를 다시
 * 편집하는 화면으로 갈 수 없고, 실패에서도 재시도는 명시적 행동이어야 한다.
 */
export function stepBack(state: FlowState): FlowState | null {
  if (state.current.step === 'result' || state.current.step === 'failure') return null
  const previous = state.past.at(-1)
  return previous ? { current: previous, past: state.past.slice(0, -1) } : null
}

function go(state: FlowState, next: Flow): FlowState {
  return { current: next, past: [...state.past, state.current] }
}

/** 확정을 지난 뒤에만 결과·실패가 있다. 그 전이면 답이 없다 */
function sealedOf(state: FlowState): SealedDraft | null {
  const { current } = state
  return current.step === 'confirm' || current.step === 'result' || current.step === 'failure'
    ? current.draft
    : null
}

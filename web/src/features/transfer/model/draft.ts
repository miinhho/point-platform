import { parseInput } from '@/domain/points'
import type { PointType, Points, TransferKind, User } from '@/domain/types'

/** 키패드 입력 자릿수 상한. 한글 병기가 성립하는 범위 안이다 */
const MAX_AMOUNT_DIGITS = 13

// 무엇을 · 누구에게 · 얼마. 내비게이션과 분리한다.
export interface Draft {
  kind: TransferKind
  pointType: PointType
  to: User | null
  /** 키패드가 만든 문자열. 숫자 변환은 읽을 때 한다. */
  raw: string
  /** 확정 화면 진입 시 생긴다. 금액·대상이 바뀌면 버린다. */
  idempotencyKey: string | null
}

export function startDraft(pointType: PointType, kind: TransferKind = 'transfer'): Draft {
  return { kind, pointType, to: null, raw: '', idempotencyKey: null }
}

export function amountOf(draft: Draft): Points {
  return parseInput(draft.raw)
}

export function withRecipient(draft: Draft, to: User): Draft {
  // 같은 키로 다른 사람에게 보내면 서버가 먼저 것을 돌려준다.
  return { ...draft, to, idempotencyKey: null }
}

export function appendDigit(draft: Draft, digit: string): Draft {
  // "007" 이 되면 한글 표기가 흔들린다.
  if (draft.raw === '' && digit === '0') return draft
  if (draft.raw.length >= MAX_AMOUNT_DIGITS) return draft
  return { ...draft, raw: draft.raw + digit, idempotencyKey: null }
}

export function removeDigit(draft: Draft): Draft {
  return { ...draft, raw: draft.raw.slice(0, -1), idempotencyKey: null }
}

export function clearAmount(draft: Draft): Draft {
  return { ...draft, raw: '', idempotencyKey: null }
}

/** 확정 화면까지 가서 거절당하지 않게 미리 막는다. 최종 판단은 서버가 한다. */
export function isReady(draft: Draft, ceiling: Points): boolean {
  const amount = amountOf(draft)
  return draft.to !== null && amount > 0 && amount <= ceiling
}

/** 확정 화면 진입. 여기서 멱등성 키가 생긴다 */
export function seal(draft: Draft, newKey: () => string): Draft {
  return draft.idempotencyKey ? draft : { ...draft, idempotencyKey: newKey() }
}

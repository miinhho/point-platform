import { MAX_AMOUNT_DIGITS } from '@/domain/rules'
import { parseInput } from '@/domain/points'
import type { PointType, Points, TransferKind, User } from '@/domain/types'

/**
 * 보내려는 것.
 *
 * 내비게이션과 분리한다. 1차 구현은 둘을 한 리듀서에 넣었고, 그래서 이체와 아무
 * 상관없는 내역 화면이 "이체 플로우" 안에 들어와 있었다.
 *
 * 이 앱에서 초안은 **무엇을 · 누구에게 · 얼마** 세 조각이다. 첫 조각이 있는 것이
 * 1차 구현과 다르다 — 포인트가 여럿이면 `30,000` 만으로는 아무것도 정해지지 않는다.
 */
export interface Draft {
  kind: TransferKind
  /** 무엇을 보내는가. 이것 없이는 금액이 의미가 없다 */
  pointType: PointType
  to: User | null
  /** 키패드가 만든 문자열. 숫자로 바꾸는 것은 읽을 때 한다 */
  raw: string
  /**
   * 확정 화면에 들어갈 때 만든다.
   *
   * 재시도는 **같은 키**를 다시 쓴다. 금액이나 대상을 고치면 버린다 —
   * 다른 금액은 다른 이체이고, 같은 키로 보내면 서버가 먼저 것을 돌려준다.
   */
  idempotencyKey: string | null
}

export function startDraft(pointType: PointType, kind: TransferKind = 'transfer'): Draft {
  return { kind, pointType, to: null, raw: '', idempotencyKey: null }
}

export function amountOf(draft: Draft): Points {
  return parseInput(draft.raw)
}

export function withRecipient(draft: Draft, to: User): Draft {
  // 대상이 바뀌면 키를 버린다. 같은 키로 다른 사람에게 보내면 서버가 먼저 것을 돌려준다.
  return { ...draft, to, idempotencyKey: null }
}

export function appendDigit(draft: Draft, digit: string): Draft {
  // 앞자리 0 을 허용하면 "007" 이 만들어지고 한글 표기가 흔들린다.
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

/**
 * 확정 화면에 들어갈 준비가 됐는가.
 *
 * 상한은 서버가 최종 판단하지만, 확정 화면까지 가서 거절당하면 사용자는 자기가
 * 뭘 잘못했는지 모른 채 처음으로 돌아간다.
 */
export function isReady(draft: Draft, ceiling: Points): boolean {
  const amount = amountOf(draft)
  return draft.to !== null && amount > 0 && amount <= ceiling
}

/** 확정 화면 진입. 여기서 멱등성 키가 생긴다 */
export function seal(draft: Draft, newKey: () => string): Draft {
  return draft.idempotencyKey ? draft : { ...draft, idempotencyKey: newKey() }
}

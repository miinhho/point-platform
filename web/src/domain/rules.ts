// 도메인 규칙 상수. 근거는 docs/JOURNEY.md 의 해당 순간에 있다.

import type { TransferKind } from './types'

/**
 * 확정에 필요한 홀드 시간 (여정 4 — 보낼지 결정한다).
 *
 * 금액과 무관하게 일정하다. 금액이 커질수록 무거워지는 설계를 검토했다가 버렸다
 * (docs/JOURNEY.md 의 "버린 것과 이유"). 홀드가 존재하는 이유는 위험도 전달이 아니라
 * 오터치 방지다 — 탭은 스크롤 중 스칠 수 있지만 홀드는 지속적 의사표시라서
 * 실수로 하기 어렵고, 누르고 있는 동안 화면을 읽을 시간이 생긴다.
 */
export const HOLD_MS = 600

/**
 * 취소 창 (여정 5 — 보내는 중이다).
 *
 * 이 시간 동안 서버는 **아무 처리도 하지 않는다.** 취소할 수 있다고 말하면서
 * 이미 출금해 두면 그건 거짓말이다.
 *
 * 발행이 더 긴 것은 회수 불가능성이 다르기 때문이다 (여정 7). 이체는 내 잔액을
 * 줄이지만 발행은 전체 유통량을 늘리고, 사용자들이 소비한 뒤에는 되돌릴 수 없다.
 */
const CANCEL_WINDOW_MS: Record<TransferKind, number> = {
  transfer: 3_000,
  issue: 8_000,
}

export function cancelWindowFor(kind: TransferKind): number {
  return CANCEL_WINDOW_MS[kind]
}

/**
 * 지금이 취소 창 안인가 (여정 5).
 *
 * 서버가 준 `cancelableUntil` 만 본다. 클라이언트가 자기 시계로 창의 길이를 계산하면,
 * 기기 시각이 틀어진 사용자에게는 취소 버튼이 있는데 눌리지 않거나 없는데 눌리는
 * 상태가 생긴다. 어느 쪽이든 되돌릴 수 없는 행동 앞에서 일어나면 안 되는 일이다.
 */
export function isInCancelWindow(cancelableUntil: string, now: number = Date.now()): boolean {
  return now < Date.parse(cancelableUntil)
}

/** 취소 창이 끝나기까지 남은 시간. 음수는 0 으로 접는다. */
export function cancelWindowRemaining(cancelableUntil: string, now: number = Date.now()): number {
  return Math.max(0, Date.parse(cancelableUntil) - now)
}

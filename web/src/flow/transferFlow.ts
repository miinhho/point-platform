// 송금 플로우 상태 기계.
//
// 화면 전환을 라우터가 아니라 상태 기계로 다룬다. 헌법 17조가 요구하기 때문이다.
// 시스템 back 버튼의 의미는 현재 상태에 따라 달라져야 하고 — "송금 진행 중 back 은
// 아무것도 하지 않는다" — 그 판단은 한곳에 모여 있어야 한다. 라우터의 history pop 에
// 맡기면 이 규칙을 표현할 방법이 없다.

import type { Failure, Points, Transfer, TransferKind, User } from '../domain/types'
import { newIdempotencyKey } from '../api/contract'
import { parseInput } from '../domain/points'

export type Step =
  | 'home'
  | 'history'
  | 'historyDetail'
  | 'pickRecipient'
  | 'enterAmount'
  | 'confirm'
  | 'sending'
  | 'done'
  | 'failed'

/**
 * 확정 화면에 진입할 때 멱등성 키를 만든다 (docs/API.md).
 * 재시도는 같은 키를 재사용해야 하므로, 키는 confirm 이후 상태에 계속 실려 다닌다.
 */
interface Draft {
  kind: TransferKind
  to: User
  amount: Points
  idempotencyKey: string
  /** 금액을 고치러 돌아갔을 때 back 이 어디로 가야 하는지 알기 위해 유지한다 */
  origin: AmountOrigin
}

/**
 * 금액 입력 화면에 어디서 왔는가.
 *
 * 헌법 2조를 지키려면 홈의 최근 대상에서 금액 입력으로 직행해야 한다
 * (대상 → 금액 → 홀드 확정, 탭 4회). 그런데 그러면 back 이 돌아갈 곳이
 * 경로마다 다르므로, 상태가 출처를 기억해야 한다.
 */
export type AmountOrigin = 'home' | 'picker'

export type FlowState =
  | { step: 'home' }
  /**
   * 내역. 송금 플로우와 같은 상태 기계에 둔다.
   *
   * 별도 라우터로 빼면 back 의 의미를 정하는 곳이 둘이 되고, 그러면 "보내는 중에는
   * back 이 아무것도 하지 않는다" 같은 규칙을 한곳에서 보장할 수 없다.
   */
  | { step: 'history' }
  | { step: 'historyDetail'; transfer: Transfer }
  | { step: 'pickRecipient'; kind: TransferKind; query: string }
  | { step: 'enterAmount'; kind: TransferKind; to: User; raw: string; origin: AmountOrigin }
  | { step: 'confirm'; draft: Draft }
  | { step: 'sending'; draft: Draft; transfer: Transfer }
  | { step: 'done'; draft: Draft; transfer: Transfer }
  | { step: 'failed'; draft: Draft; failure: Failure; transfer?: Transfer }

export type FlowAction =
  | { type: 'start'; kind: TransferKind }
  | { type: 'openHistory' }
  | { type: 'openHistoryDetail'; transfer: Transfer }
  | { type: 'setQuery'; query: string }
  | { type: 'pick'; to: User }
  /** 홈의 최근 대상에서 금액 입력으로 직행 (헌법 2조) */
  | { type: 'quickPick'; kind: TransferKind; to: User }
  | { type: 'digit'; digit: string }
  | { type: 'backspace' }
  | { type: 'clearAmount' }
  | { type: 'toConfirm' }
  | { type: 'submitted'; transfer: Transfer }
  | { type: 'transferChanged'; transfer: Transfer }
  | { type: 'failed'; failure: Failure; transfer?: Transfer }
  | { type: 'retry' }
  | { type: 'editAmount' }
  | { type: 'toHome' }

export const initialFlow: FlowState = { step: 'home' }

/** 키패드 입력 상한. 표기가 깨지는 구간까지 받을 이유가 없다. */
const MAX_DIGITS = 13

export function currentAmount(state: FlowState): Points {
  switch (state.step) {
    case 'enterAmount':
      return parseInput(state.raw)
    case 'confirm':
    case 'sending':
    case 'done':
    case 'failed':
      return state.draft.amount
    default:
      return 0
  }
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'start':
      return { step: 'pickRecipient', kind: action.kind, query: '' }

    case 'openHistory':
      // 홈에서 열거나, 상세에서 돌아온다. 송금 도중에 내역으로 새는 경로는 만들지
      // 않는다 — 되돌릴 수 없는 행동을 앞두고 화면을 떠나면 돌아올 자리가 애매해진다.
      return state.step === 'home' || state.step === 'historyDetail' ? { step: 'history' } : state

    case 'openHistoryDetail':
      return state.step === 'history'
        ? { step: 'historyDetail', transfer: action.transfer }
        : state

    case 'setQuery':
      return state.step === 'pickRecipient' ? { ...state, query: action.query } : state

    case 'pick':
      if (state.step !== 'pickRecipient') return state
      return { step: 'enterAmount', kind: state.kind, to: action.to, raw: '', origin: 'picker' }

    case 'quickPick':
      if (state.step !== 'home') return state
      return { step: 'enterAmount', kind: action.kind, to: action.to, raw: '', origin: 'home' }

    case 'digit': {
      if (state.step !== 'enterAmount') return state
      // 앞자리 0 을 허용하면 "007" 같은 입력이 만들어지고 한글 표기가 흔들린다.
      if (state.raw === '' && action.digit === '0') return state
      if (state.raw.length >= MAX_DIGITS) return state
      return { ...state, raw: state.raw + action.digit }
    }

    case 'backspace':
      if (state.step !== 'enterAmount') return state
      return { ...state, raw: state.raw.slice(0, -1) }

    case 'clearAmount':
      return state.step === 'enterAmount' ? { ...state, raw: '' } : state

    case 'toConfirm': {
      if (state.step !== 'enterAmount') return state
      const amount = parseInput(state.raw)
      if (amount <= 0) return state
      return {
        step: 'confirm',
        draft: {
          kind: state.kind,
          to: state.to,
          amount,
          idempotencyKey: newIdempotencyKey(),
          origin: state.origin,
        },
      }
    }

    case 'submitted':
      if (state.step !== 'confirm') return state
      return { step: 'sending', draft: state.draft, transfer: action.transfer }

    case 'transferChanged': {
      // 서버가 알려준 것만 반영한다. 클라이언트가 확정을 추측하지 않는다 (헌법 11조).
      if (state.step !== 'sending') return state
      const { transfer } = action
      if (transfer.status === 'confirmed') {
        return { step: 'done', draft: state.draft, transfer }
      }
      if (transfer.status === 'cancelled') {
        return { step: 'home' }
      }
      if (transfer.status === 'failed') {
        return {
          step: 'failed',
          draft: state.draft,
          failure: transfer.failure ?? { code: 'SERVER', message: '처리에 실패했다' },
          transfer,
        }
      }
      return { ...state, transfer }
    }

    case 'failed': {
      // 실패해도 입력을 버리지 않는다 (헌법 12조). draft 가 그대로 남아 재시도에 쓰인다.
      if (state.step !== 'confirm' && state.step !== 'sending') return state
      return { step: 'failed', draft: state.draft, failure: action.failure, transfer: action.transfer }
    }

    case 'retry':
      // 같은 멱등성 키로 돌아간다. 이중 이체를 막는 것은 이 키뿐이다.
      return state.step === 'failed' ? { step: 'confirm', draft: state.draft } : state

    case 'editAmount': {
      // 금액을 고치러 돌아갈 때는 키를 버린다. 다른 금액은 다른 이체다.
      if (state.step !== 'confirm' && state.step !== 'failed') return state
      const { kind, to, amount, origin } = state.draft
      return { step: 'enterAmount', kind, to, raw: String(amount), origin }
    }

    case 'toHome':
      return { step: 'home' }
  }
}

/**
 * 시스템 back 의 의미 (헌법 17조).
 *
 * 'exit' 는 back 을 소비하지 않는다는 뜻이다. 셸이 기본 동작(앱 종료)을 하도록 넘긴다.
 * 'ignore' 는 소비하되 아무것도 하지 않는다는 뜻이다. 되돌릴 수 없는 구간에서
 * back 은 결코 실행 취소가 아니다.
 */
export type BackResolution = { kind: 'action'; action: FlowAction } | { kind: 'exit' } | { kind: 'ignore' }

export function resolveBack(state: FlowState): BackResolution {
  switch (state.step) {
    case 'home':
      return { kind: 'exit' }

    case 'history':
      return { kind: 'action', action: { type: 'toHome' } }

    case 'historyDetail':
      return { kind: 'action', action: { type: 'openHistory' } }

    case 'pickRecipient':
      return { kind: 'action', action: { type: 'toHome' } }

    case 'enterAmount':
      // 홈에서 직행해 왔으면 홈으로, 대상 선택을 거쳐 왔으면 그 화면으로 돌아간다.
      // 사용자가 지나온 길과 back 이 어긋나면 어디로 갈지 예측할 수 없게 된다.
      return state.origin === 'home'
        ? { kind: 'action', action: { type: 'toHome' } }
        : { kind: 'action', action: { type: 'start', kind: state.kind } }

    case 'confirm':
      return { kind: 'action', action: { type: 'editAmount' } }

    case 'sending':
      // 취소 창 중이든 처리 중이든 back 은 아무것도 하지 않는다.
      //
      // 취소 창 중: 취소는 명시적 행동이어야 한다. back 으로 취소되면 사용자는
      //   자기가 취소했는지 화면을 벗어났는지 구분할 수 없다.
      // 처리 중: 화면을 벗어나면 사용자가 돈의 위치를 알 수 없게 된다.
      return { kind: 'ignore' }

    case 'done':
      return { kind: 'action', action: { type: 'toHome' } }

    case 'failed':
      // 실패 화면에서 나가는 것은 허용한다. 실패는 되돌릴 수 없는 구간이 아니다.
      // 단 입력은 보존되어야 하므로 홈으로 보내되, 재시도는 화면의 명시적 행동으로 남긴다.
      return { kind: 'action', action: { type: 'toHome' } }
  }
}

/** 이 상태에서 사용자가 취할 수 있는 행동이 남아 있는가. 빈 상태를 만들지 않기 위한 점검. */
export function isTerminal(state: FlowState): boolean {
  return state.step === 'done' || state.step === 'failed'
}

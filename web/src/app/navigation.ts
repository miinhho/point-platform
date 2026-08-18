import type { TransferId } from '@/domain/types'

/**
 * 내비게이션.
 *
 * 1차 구현은 이체 상태 기계 하나가 화면 이동까지 겸했고, 거기에 내역 화면까지
 * 들어가면서 "이체 플로우"라는 이름과 내용이 어긋났다. 여기서는 **어디에 있는가**
 * 만 다룬다. 무엇을 보내는 중인가는 `features/transfer/draft.ts` 가 따로 안다.
 *
 * 탭 하나에 스택 하나를 얹는다. 이 구조가 공짜로 주는 것이 있다 — 1차 구현에는
 * "금액 화면에 홈에서 왔는지 대상 선택에서 왔는지" 기억하는 `origin` 필드가 있었는데,
 * 스택에는 지나온 길이 이미 들어 있어서 그 필드가 필요 없다.
 *
 * 라우터를 쓰지 않는 이유는 back 의 의미가 화면마다 달라야 하기 때문이다.
 * 요청이 나가는 중에는 back 이 아무것도 하지 않아야 하고, 완료 화면에서 back 은
 * 플로우로 되돌아가는 것이 아니라 나가는 것이다. history pop 에 맡기면 표현할 수 없다.
 */
export type TabName = 'home' | 'history' | 'settings'

export const TABS: readonly TabName[] = ['home', 'history', 'settings']

export type Screen =
  | { name: 'pickRecipient' }
  | { name: 'enterAmount' }
  | { name: 'confirm' }
  /** 확정된 이체. 서버가 돌려준 것만 여기 온다 */
  | { name: 'result'; transferId: TransferId }
  | { name: 'failure' }
  | { name: 'historyDetail'; transferId: TransferId }
  | { name: 'issuer' }

export interface NavState {
  tab: TabName
  /** 탭 위에 쌓인 화면. 비어 있으면 탭의 뿌리 화면이다 */
  stack: Screen[]
}

export const initialNav: NavState = { tab: 'home', stack: [] }

export function currentScreen(state: NavState): Screen | null {
  return state.stack.at(-1) ?? null
}

export function push(state: NavState, screen: Screen): NavState {
  return { ...state, stack: [...state.stack, screen] }
}

export function pop(state: NavState): NavState {
  return { ...state, stack: state.stack.slice(0, -1) }
}

/** 스택을 비우고 탭 뿌리로 돌아간다. 플로우를 끝낼 때 쓴다 */
export function resetToRoot(state: NavState): NavState {
  return { ...state, stack: [] }
}

/**
 * 스택에서 그 화면이 맨 위가 될 때까지 꺼낸다.
 *
 * 실패 화면에서 "다시 시도"나 "금액 고치기"로 돌아갈 때 쓴다. 스택을 새로 만들지
 * 않는 것이 중요하다 — 새로 만들면 지나온 길이 사라져서, 재시도 뒤의 확정 화면에서
 * 뒤로 갔을 때 금액 화면이 아니라 홈으로 나가 버린다.
 *
 * 그 화면이 스택에 없으면 아무것도 하지 않는다. 없는 곳으로 돌아갈 수는 없다.
 */
export function popTo(state: NavState, name: Screen['name']): NavState {
  const index = state.stack.findLastIndex((screen) => screen.name === name)
  if (index < 0) return state
  return { ...state, stack: state.stack.slice(0, index + 1) }
}

/**
 * 탭을 바꾼다.
 *
 * 스택을 비운다. 탭마다 스택을 따로 보관하는 앱도 있지만, 이 앱에서 스택에 쌓이는
 * 것은 대부분 되돌릴 수 없는 행동으로 가는 길이다. 탭을 옮겼다가 돌아왔을 때
 * 그 길 중간에 서 있으면 사용자는 자기가 어디까지 했는지 알 수 없다.
 */
export function selectTab(_state: NavState, tab: TabName): NavState {
  return { tab, stack: [] }
}

export type BackResolution =
  /** 상태를 바꿨다 */
  | { kind: 'handled'; next: NavState }
  /** 소비했지만 아무것도 하지 않았다. 되돌릴 수 없는 구간이다 */
  | { kind: 'ignored' }
  /** 소비하지 않았다. 셸이 앱을 닫는다 */
  | { kind: 'exit' }

/**
 * 시스템 back 의 의미.
 *
 * @param locked 요청이 나가는 중인가. 이때 back 은 실행 취소가 아니다
 */
export function resolveBack(state: NavState, locked = false): BackResolution {
  const screen = currentScreen(state)

  if (screen) {
    // 요청이 나가는 중에는 아무것도 하지 않는다. 화면을 벗어나면 사용자가
    // 돈의 위치를 알 수 없게 되고, 취소로 오해할 수도 있다.
    if (locked) return { kind: 'ignored' }

    // 끝난 뒤의 back 은 플로우로 되돌아가는 것이 아니다. 확정된 이체를 다시
    // 편집하는 화면으로 갈 수는 없고, 실패 화면에서도 재시도는 명시적 행동이어야 한다.
    if (screen.name === 'result' || screen.name === 'failure') {
      return { kind: 'handled', next: resetToRoot(state) }
    }

    return { kind: 'handled', next: pop(state) }
  }

  // 탭 뿌리에서는 홈으로 모인 다음 앱을 나간다. 안드로이드의 관례다.
  if (state.tab !== 'home') return { kind: 'handled', next: selectTab(state, 'home') }
  return { kind: 'exit' }
}

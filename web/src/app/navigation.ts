import type { PointType, PointTypeId, Transfer, TransferId } from '@/api/contract'

// 근거: docs/JOURNEY.md · 탭 하나에 스택 하나
export type TabName = 'home' | 'history' | 'settings'

export const TABS: readonly TabName[] = ['home', 'history', 'settings']

export type Screen =
  | { name: 'pickRecipient' }
  | { name: 'enterAmount' }
  | { name: 'confirm' }
  /** 서버가 돌려준 이체를 그대로 싣는다. 다시 읽으면 그 사이 빈 프레임이 생긴다 */
  | { name: 'result'; transfer: Transfer }
  | { name: 'failure' }
  | { name: 'historyDetail'; transferId: TransferId }
  | { name: 'issuer' }
  | { name: 'createPoint' }
  | { name: 'changeCap'; pointTypeId: PointTypeId }
  /** 서버가 돌려준 포인트를 그대로 싣는다 — 다시 읽으면 그 사이 빈 프레임이 생긴다 */
  | { name: 'pointCreated'; pointType: PointType }

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
 * 그 화면이 맨 위가 될 때까지 꺼낸다. 없으면 그대로 둔다.
 * 스택을 새로 만들면 지나온 길이 사라져 뒤로가 홈으로 나가 버린다.
 */
export function popTo(state: NavState, name: Screen['name']): NavState {
  const index = state.stack.findLastIndex((screen) => screen.name === name)
  if (index < 0) return state
  return { ...state, stack: state.stack.slice(0, index + 1) }
}

/** 스택을 비운다. 되돌릴 수 없는 행동으로 가는 길 중간에 서 있게 두지 않는다. */
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

/** @param locked 요청이 나가는 중인가. 이때 back 은 실행 취소가 아니다. */
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

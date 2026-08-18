import { atom } from 'jotai'
import {
  currentScreen,
  initialNav,
  push,
  resetToRoot,
  resolveBack,
  selectTab,
  type BackResolution,
  type NavState,
  type Screen,
  type TabName,
} from './navigation'

/**
 * 클라이언트 상태.
 *
 * 여기 있는 것은 서버가 모르는 것뿐이다 — 어디에 있는가, 개발자 패널이 열렸는가.
 * 잔액이나 사용자 목록은 여기 두지 않는다. 서버가 진실인 값을 여기 복사해 두면
 * 그 순간부터 진실이 둘이 되고, 둘 중 하나는 반드시 낡는다.
 */
export const navAtom = atom<NavState>(initialNav)

export const currentScreenAtom = atom((get) => currentScreen(get(navAtom)))
export const tabAtom = atom((get) => get(navAtom).tab)

/** 화면을 쌓는다 */
export const goAtom = atom(null, (get, set, screen: Screen) => {
  set(navAtom, push(get(navAtom), screen))
})

/** 탭을 바꾼다 */
export const selectTabAtom = atom(null, (get, set, tab: TabName) => {
  set(navAtom, selectTab(get(navAtom), tab))
})

/** 플로우를 끝내고 탭 뿌리로 */
export const leaveFlowAtom = atom(null, (get, set) => {
  set(navAtom, resetToRoot(get(navAtom)))
})

/**
 * 시스템 back.
 *
 * 결과를 돌려준다 — 셸(웹의 히스토리 덫, RN 의 BackHandler)이 소비 여부를 알아야
 * 하기 때문이다. `locked` 는 요청이 나가는 중인지이고, 그 값은 TanStack Query 의
 * 뮤테이션 상태에서 온다. 내비게이션이 그것을 직접 읽지 않게 인자로 받는다 —
 * 그러면 내비게이션 모델이 서버 상태를 몰라도 된다.
 */
export const backAtom = atom(null, (get, set, locked: boolean): BackResolution['kind'] => {
  const resolution = resolveBack(get(navAtom), locked)
  if (resolution.kind === 'handled') set(navAtom, resolution.next)
  return resolution.kind
})

/** 개발자 패널. 실서버로 바꾸면 사라진다 */
export const devPanelOpenAtom = atom(false)

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

// 서버가 모르는 것만 둔다. 잔액·사용자는 TanStack Query 가 갖는다.
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

/** 사람이 바뀌면 화면도 처음으로. 앞사람이 보던 탭에서 시작할 이유가 없다 */
export const resetNavAtom = atom(null, (_get, set) => {
  set(navAtom, initialNav)
})

/** 플로우를 끝내고 탭 뿌리로 */
export const leaveFlowAtom = atom(null, (get, set) => {
  set(navAtom, resetToRoot(get(navAtom)))
})

/** 셸이 소비 여부를 알아야 하므로 결과를 돌려준다. `locked` 는 호출부가 넘긴다. */
export const backAtom = atom(null, (get, set, locked: boolean): BackResolution['kind'] => {
  const resolution = resolveBack(get(navAtom), locked)
  if (resolution.kind === 'handled') set(navAtom, resolution.next)
  return resolution.kind
})

/** 개발자 패널. 실서버로 바꾸면 사라진다 */
export const devPanelOpenAtom = atom(false)

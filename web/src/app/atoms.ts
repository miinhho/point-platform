import { atom } from 'jotai'
import { pushRoute } from './browserHistory'
import {
  currentRoute,
  initialNav,
  push,
  resetToRoot,
  selectTab,
  type NavState,
} from './navigation'
import type { Route, TabName } from './routes'

// 서버가 모르는 것만 둔다. 잔액·사용자는 TanStack Query 가 갖는다.
export const navAtom = atom<NavState>(initialNav)

export const routeAtom = atom((get) => currentRoute(get(navAtom)))
export const tabAtom = atom((get) => get(navAtom).tab)

/** 화면을 연다. 주소가 함께 움직인다 */
export const goAtom = atom(null, (get, set, route: Route) => {
  commit(set, push(get(navAtom), route))
})

/** 탭을 바꾼다. 그 탭의 스택은 그대로다 — 탭 스택은 세션 안에서 산다 */
export const selectTabAtom = atom(null, (get, set, tab: TabName) => {
  commit(set, selectTab(get(navAtom), tab))
})

/** 그 탭의 뿌리로. 보낸 뒤에 오는 자리다 — docs/REBUILD.md 「주소」 */
export const toRootAtom = atom(null, (get, set) => {
  commit(set, resetToRoot(get(navAtom)))
})

/** 사람이 바뀌면 화면도 처음으로. 앞사람이 보던 탭에서 시작할 이유가 없다 */
export const resetNavAtom = atom(null, (_get, set) => {
  commit(set, initialNav)
})

/** 시스템 back 이 히스토리 항목을 꺼냈다. 그 항목에 실려 있던 상태로 돌아간다 */
export const restoreNavAtom = atom(null, (_get, set, nav: NavState) => {
  set(navAtom, nav)
})

type Set = (atom: typeof navAtom, value: NavState) => void

function commit(set: Set, next: NavState): void {
  set(navAtom, next)
  pushRoute(next)
}

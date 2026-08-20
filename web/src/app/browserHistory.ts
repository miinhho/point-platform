import { enter, initialNav, type NavState } from './navigation'
import { currentRoute } from './navigation'
import { fromPath, toPath } from './routes'

/**
 * 주소와 내비게이션을 잇는다.
 *
 * **브라우저 히스토리가 뒤로 가기의 진실이다.** 우리 상태는 항목마다 함께 실린다 —
 * 탭을 오가며 들어간 화면의 순서를 아는 것은 히스토리뿐이라 우리 스택 규칙으로
 * 되짚으면 어긋난다.
 */

/** 흐름은 주소가 없다. 그래서 항목 **하나**만 쓰고 그 자리를 계속 다시 채운다 */
interface Entry {
  nav: NavState
  /** 이체 흐름이 열려 있는 동안 놓아 두는 항목. 주소는 그대로다 */
  flow?: true
}

export function readEntry(): { nav: NavState; unknownPath: boolean } {
  const route = fromPath(location.pathname)
  if (!route) return { nav: initialNav, unknownPath: true }
  return { nav: enter(route), unknownPath: false }
}

/** 첫 항목에는 state 가 없다. 새로고침해도 그 화면이 뜨도록 여기서 채운다 */
export function primeEntry(nav: NavState): void {
  history.replaceState({ nav } satisfies Entry, '', toPath(currentRoute(nav)))
}

export function pushRoute(nav: NavState): void {
  history.pushState({ nav } satisfies Entry, '', toPath(currentRoute(nav)))
}

/** 주소는 그대로 두고 항목만 하나 놓는다. back 이 흐름 안에서 소비되게 하는 자리다 */
export function armFlow(nav: NavState): void {
  if ((history.state as Entry | null)?.flow) return
  history.pushState({ nav, flow: true } satisfies Entry, '', location.href)
}

export function navOf(state: unknown): NavState | null {
  return (state as Entry | null)?.nav ?? null
}

/** 흐름이 열린 채로 놓아 둔 항목이 지금 자리인가 */
export function flowArmed(): boolean {
  return (history.state as Entry | null)?.flow === true
}

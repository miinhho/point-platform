import { ROOT, tabOf, type Route, type TabName } from './routes'

/**
 * 탭마다 자기 스택. **주소에 실리지 않는다** — 주소는 남에게 보내는 것이고 거기에
 * 내비게이션 상태가 실리면 주소가 장소가 아니라 나를 가리킨다. 계약: docs/REBUILD.md
 *
 * 뿌리는 스택에 담지 않는다. 담으면 「비었다」와 「뿌리가 쌓였다」가 둘로 갈린다.
 */
export interface NavState {
  tab: TabName
  stacks: Record<TabName, Route[]>
}

const EMPTY: NavState['stacks'] = { home: [], history: [], settings: [] }

export const initialNav: NavState = { tab: 'home', stacks: EMPTY }

export function currentRoute(state: NavState): Route {
  return state.stacks[state.tab].at(-1) ?? ROOT[state.tab]
}

/** 그 탭에 화면을 쌓는다. 어느 탭인지는 현재 탭이지 라우트의 성질이 아니다 */
export function push(state: NavState, route: Route): NavState {
  return withStack(state, state.tab, [...state.stacks[state.tab], route])
}

/**
 * 지금 화면을 다른 것으로 갈아 끼운다. 쌓지 않는다 — 뒤로 가기가 그 주소로 다시
 * 가면 같은 자리를 돈다. 계약: docs/REBUILD.md 「막힌 주소는 은행 페이지로 대체한다」
 */
export function replace(state: NavState, route: Route): NavState {
  return push(pop(state), route)
}

export function pop(state: NavState): NavState {
  return withStack(state, state.tab, state.stacks[state.tab].slice(0, -1))
}

/**
 * 탭을 바꾼다. **스택을 비우지 않는다** — 탭 스택은 그 세션 안에서 산다.
 * 되돌릴 수 없는 길 중간에 서 있게 두는 것 아니냐는 걱정은 이제 없다:
 * 이체 흐름은 라우트가 아니라 그 위에 겹치는 층이라 탭 스택에 들어오지 않는다.
 */
export function selectTab(state: NavState, tab: TabName): NavState {
  return { ...state, tab }
}

/** 그 탭의 뿌리로. 지금 탭만 비운다 */
export function resetToRoot(state: NavState): NavState {
  return withStack(state, state.tab, [])
}

/**
 * 주소로 들어왔다. 그 탭이 그 화면으로 열리고 **나머지 두 탭은 뿌리에서 시작한다** —
 * 주소 하나가 스택 셋을 동시에 복원할 수 없다. 계약: docs/REBUILD.md
 */
export function enter(route: Route): NavState {
  const tab = tabOf(route)
  const root = ROOT[tab].name === route.name
  return { tab, stacks: { ...EMPTY, [tab]: root ? [] : [route] } }
}

function withStack(state: NavState, tab: TabName, stack: Route[]): NavState {
  return { ...state, stacks: { ...state.stacks, [tab]: stack } }
}

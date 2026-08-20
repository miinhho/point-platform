import type { IssueId, PointTypeId, TransferId } from '@/shared/contract'

// 근거: docs/REBUILD.md 「주소」 — 장소는 주소를 갖고, 진행 중인 일은 갖지 않는다
export type TabName = 'home' | 'history' | 'settings'

export const TABS: readonly TabName[] = ['home', 'history', 'settings']

/**
 * 주소를 갖는 화면.
 *
 * 이체 흐름(대상 선택 · 금액 · 확정 · 결과 · 실패)은 여기 없다. 그것은 장소가
 * 아니라 진행 중인 일이고, 주소를 주면 새로고침이 무슨 뜻인지 답할 수 없다 —
 * 다시 확정하는 것인가, 처음부터인가. 계약: docs/REBUILD.md
 */
export type Route =
  | { name: 'home' }
  | { name: 'history' }
  | { name: 'historyDetail'; transferId: TransferId }
  | { name: 'issueDetail'; issueId: IssueId }
  | { name: 'settings' }
  | { name: 'createPoint' }
  | { name: 'bank'; pointTypeId: PointTypeId }
  | { name: 'members'; pointTypeId: PointTypeId }
  | { name: 'invite'; pointTypeId: PointTypeId }

/** 탭의 뿌리. 스택이 비면 여기다 */
export const ROOT: Record<TabName, Route> = {
  home: { name: 'home' },
  history: { name: 'history' },
  settings: { name: 'settings' },
}

/** switch 라서 라우트를 추가하면 컴파일이 주소 없는 것을 잡는다 */
export function toPath(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/'
    case 'history':
      return '/history'
    case 'historyDetail':
      return `/history/${route.transferId}`
    case 'issueDetail':
      return `/history/issues/${route.issueId}`
    case 'settings':
      return '/settings'
    case 'createPoint':
      return '/points/new'
    case 'bank':
      return `/points/${route.pointTypeId}`
    case 'members':
      return `/points/${route.pointTypeId}/members`
    case 'invite':
      return `/points/${route.pointTypeId}/invite`
  }
}

/**
 * 읽지 못하는 주소는 `null` 이다. 홈으로 접어 버리지 않는 이유는 부르는 쪽이
 * 「없는 주소로 들어왔다」와 「홈으로 들어왔다」를 가릴 수 있어야 해서다.
 */
export function fromPath(path: string): Route | null {
  const [first, second, third, ...rest] = path.split('/').filter(Boolean)
  if (rest.length > 0) return null

  if (first === undefined) return { name: 'home' }

  if (first === 'settings') return second === undefined ? { name: 'settings' } : null

  if (first === 'history') {
    if (second === undefined) return { name: 'history' }
    // 발행 상세가 이체 상세와 같은 자리를 쓰면 id 하나로 둘을 가려야 한다.
    if (second === 'issues') return third === undefined ? null : { name: 'issueDetail', issueId: third }
    return third === undefined ? { name: 'historyDetail', transferId: second } : null
  }

  if (first === 'points') {
    if (second === undefined) return null
    if (second === 'new') return third === undefined ? { name: 'createPoint' } : null
    if (third === undefined) return { name: 'bank', pointTypeId: second }
    if (third === 'members') return { name: 'members', pointTypeId: second }
    if (third === 'invite') return { name: 'invite', pointTypeId: second }
    return null
  }

  return null
}

/** 딥링크로 들어왔을 때 어느 탭이 열리는가 */
export function tabOf(route: Route): TabName {
  switch (route.name) {
    case 'history':
    case 'historyDetail':
    case 'issueDetail':
      return 'history'
    case 'settings':
      return 'settings'
    case 'home':
    case 'createPoint':
    case 'bank':
    case 'members':
    case 'invite':
      return 'home'
  }
}

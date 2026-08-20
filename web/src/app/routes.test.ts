import { describe, expect, it } from 'vitest'
import { ROOT, TABS, fromPath, tabOf, toPath, type Route } from './routes'

/**
 * 주소가 진실이다 — 새로고침하거나 링크로 들어오면 그 화면이 뜬다.
 * 계약: docs/REBUILD.md 「주소」
 */
const SAMPLE: Record<Route['name'], Route> = {
  home: { name: 'home' },
  history: { name: 'history' },
  historyDetail: { name: 'historyDetail', transferId: 't_1' },
  issueDetail: { name: 'issueDetail', issueId: 'i_1' },
  settings: { name: 'settings' },
  createPoint: { name: 'createPoint' },
  bank: { name: 'bank', pointTypeId: 'pt_on' },
  members: { name: 'members', pointTypeId: 'pt_on' },
  invite: { name: 'invite', pointTypeId: 'pt_on' },
}

describe('주소와 화면', () => {
  // 표를 손으로 적는다. 왕복만 검사하면 둘 다 틀려도 통과한다.
  it.each([
    [SAMPLE.home, '/'],
    [SAMPLE.history, '/history'],
    [SAMPLE.historyDetail, '/history/t_1'],
    [SAMPLE.issueDetail, '/history/issues/i_1'],
    [SAMPLE.settings, '/settings'],
    [SAMPLE.createPoint, '/points/new'],
    [SAMPLE.bank, '/points/pt_on'],
    [SAMPLE.members, '/points/pt_on/members'],
    [SAMPLE.invite, '/points/pt_on/invite'],
  ])('%o ↔ %s', (route, path) => {
    expect(toPath(route)).toBe(path)
    expect(fromPath(path)).toEqual(route)
  })

  // 라우트를 늘리고 표만 안 늘리면 여기서 걸린다.
  it('모든 라우트가 주소를 갖는다', () => {
    for (const route of Object.values(SAMPLE)) {
      expect(fromPath(toPath(route)), route.name).toEqual(route)
    }
  })

  it.each(['/nope', '/points', '/points/pt_on/nope', '/history/t_1/extra', '/settings/x'])(
    '%s 는 읽지 못한다',
    (path) => {
      expect(fromPath(path)).toBeNull()
    },
  )

  // 홈으로 접어 버리면 부르는 쪽이 「없는 주소」와 「홈」을 가리지 못한다.
  it('읽지 못한 주소는 홈이 아니라 null 이다', () => {
    expect(fromPath('/nope')).toBeNull()
    expect(fromPath('/')).toEqual({ name: 'home' })
  })
})

describe('어느 탭이 열리는가', () => {
  it.each([
    [SAMPLE.historyDetail, 'history'],
    [SAMPLE.issueDetail, 'history'],
    [SAMPLE.settings, 'settings'],
    [SAMPLE.bank, 'home'],
    [SAMPLE.createPoint, 'home'],
  ] as const)('%o → %s', (route, tab) => {
    expect(tabOf(route)).toBe(tab)
  })

  it('탭이 셋이고 홈이 첫째다', () => {
    expect(TABS[0]).toBe('home')
    expect(TABS).toHaveLength(3)
  })

  it('탭마다 뿌리가 있고 그 뿌리는 자기 탭에 속한다', () => {
    for (const tab of TABS) expect(tabOf(ROOT[tab])).toBe(tab)
  })
})

import { describe, expect, it } from 'vitest'
import { currentRoute, enter, initialNav, pop, push, resetToRoot, selectTab } from './navigation'

const at = (state: Parameters<typeof currentRoute>[0]) => currentRoute(state).name

describe('탭 스택', () => {
  it('뿌리에서는 그 탭의 뿌리 화면이다', () => {
    expect(at(initialNav)).toBe('home')
    expect(at(selectTab(initialNav, 'settings'))).toBe('settings')
  })

  it('쌓고 꺼낸다', () => {
    const one = push(initialNav, { name: 'bank', pointTypeId: 'pt_on' })
    const two = push(one, { name: 'members', pointTypeId: 'pt_on' })
    expect(at(two)).toBe('members')
    expect(at(pop(two))).toBe('bank')
    expect(at(pop(pop(two)))).toBe('home')
  })

  // 계약: docs/REBUILD.md 「탭 스택은 그 세션 안에서 산다」
  it('탭을 바꿔도 그 탭의 스택은 남는다', () => {
    const deep = push(initialNav, { name: 'bank', pointTypeId: 'pt_on' })
    const away = selectTab(deep, 'history')
    expect(at(away)).toBe('history')
    expect(at(selectTab(away, 'home'))).toBe('bank')
  })

  it('탭마다 스택이 따로다', () => {
    const home = push(initialNav, { name: 'bank', pointTypeId: 'pt_on' })
    const history = push(selectTab(home, 'history'), { name: 'historyDetail', transferId: 't_1' })
    expect(at(history)).toBe('historyDetail')
    expect(at(selectTab(history, 'home'))).toBe('bank')
  })

  it('resetToRoot 는 지금 탭만 비운다', () => {
    const home = push(initialNav, { name: 'bank', pointTypeId: 'pt_on' })
    const history = push(selectTab(home, 'history'), { name: 'historyDetail', transferId: 't_1' })
    const reset = resetToRoot(history)
    expect(at(reset)).toBe('history')
    expect(at(selectTab(reset, 'home'))).toBe('bank')
  })
})

describe('주소로 들어온다', () => {
  it('그 라우트의 탭이 그 화면으로 열린다', () => {
    const state = enter({ name: 'members', pointTypeId: 'pt_on' })
    expect(state.tab).toBe('home')
    expect(at(state)).toBe('members')
  })

  // 주소 하나가 스택 셋을 동시에 복원할 수 없다 — 계약: docs/REBUILD.md
  it('나머지 두 탭은 뿌리에서 시작한다', () => {
    const state = enter({ name: 'historyDetail', transferId: 't_1' })
    expect(at(selectTab(state, 'home'))).toBe('home')
    expect(at(selectTab(state, 'settings'))).toBe('settings')
  })

  it('뿌리 주소로 들어오면 스택이 비어 있다 — 뿌리가 자기 위에 쌓이지 않는다', () => {
    const state = enter({ name: 'history' })
    expect(state.stacks.history).toEqual([])
    expect(at(state)).toBe('history')
  })
})

import { describe, expect, it } from 'vitest'
import type { Transfer } from '@/api/contract'
import {
  currentScreen,
  initialNav,
  pop,
  push,
  resetToRoot,
  resolveBack,
  popTo,
  selectTab,
  TABS,
  type NavState,
} from './navigation'

const at = (nav: NavState) => currentScreen(nav)?.name ?? `tab:${nav.tab}`

const TRANSFER: Transfer = {
  id: 't_1',
  idempotencyKey: 'k_1',
  pointTypeId: 'pt_on',
  fromId: 'u_minho',
  toId: 'u_jisoo',
  amount: 1_000,
  counterparty: { name: '김지수', handle: '@jisoo', nameIsShared: false },
  createdAt: '2026-08-19T00:00:00Z',
  confirmedAt: '2026-08-19T00:00:00Z',
}

describe('스택', () => {
  it('뿌리에서는 현재 화면이 없다', () => {
    expect(currentScreen(initialNav)).toBeNull()
  })

  it('쌓고 꺼낸다', () => {
    const one = push(initialNav, { name: 'pickRecipient' })
    const two = push(one, { name: 'enterAmount' })
    expect(at(two)).toBe('enterAmount')
    expect(at(pop(two))).toBe('pickRecipient')
    expect(at(pop(pop(two)))).toBe('tab:home')
  })

  // 1차 구현의 origin 필드를 없앤 근거다.
  it('금액 화면에서 뒤로 가면 지나온 길을 따른다 — 기억할 필드가 필요 없다', () => {
    const viaPicker = push(push(initialNav, { name: 'pickRecipient' }), { name: 'enterAmount' })
    expect(at(pop(viaPicker))).toBe('pickRecipient')

    const straight = push(initialNav, { name: 'enterAmount' })
    expect(at(pop(straight))).toBe('tab:home')
  })

  it('탭을 바꾸면 스택을 비운다 — 되돌릴 수 없는 길 중간에 서 있게 두지 않는다', () => {
    const deep = push(push(initialNav, { name: 'pickRecipient' }), { name: 'confirm' })
    expect(selectTab(deep, 'history')).toEqual({ tab: 'history', stack: [] })
  })

  it('탭이 셋이고 홈이 첫째다', () => {
    expect(TABS[0]).toBe('home')
    expect(TABS).toHaveLength(3)
  })
})

describe('시스템 back', () => {
  it('홈 뿌리에서는 소비하지 않는다. 셸이 앱을 닫는다', () => {
    expect(resolveBack(initialNav)).toEqual({ kind: 'exit' })
  })

  it('다른 탭 뿌리에서는 홈으로 모인다', () => {
    const nav = selectTab(initialNav, 'settings')
    expect(resolveBack(nav)).toEqual({ kind: 'handled', next: { tab: 'home', stack: [] } })
  })

  it('스택이 있으면 한 칸 꺼낸다', () => {
    const nav = push(initialNav, { name: 'pickRecipient' })
    const resolution = resolveBack(nav)
    expect(resolution.kind).toBe('handled')
    if (resolution.kind !== 'handled') return
    expect(currentScreen(resolution.next)).toBeNull()
  })

  it('요청이 나가는 중에는 소비하되 아무것도 하지 않는다', () => {
    const nav = push(initialNav, { name: 'confirm' })
    expect(resolveBack(nav, true)).toEqual({ kind: 'ignored' })
  })

  it('완료·실패에서 back 은 플로우를 벗어난다 — 한 칸 뒤로가 아니다', () => {
    const done = push(push(initialNav, { name: 'confirm' }), { name: 'result', result: TRANSFER })
    expect(resolveBack(done)).toEqual({ kind: 'handled', next: { tab: 'home', stack: [] } })

    const failed = push(push(initialNav, { name: 'confirm' }), { name: 'failure' })
    expect(resolveBack(failed)).toEqual({ kind: 'handled', next: { tab: 'home', stack: [] } })
  })

  // 리졸버와 상태 변경이 어긋나는 것을 1차 구현에서 놓쳤다. 조합으로 잡는다.
  it('handled 는 반드시 상태를 바꾼다', () => {
    const states: NavState[] = [
      selectTab(initialNav, 'history'),
      push(initialNav, { name: 'pickRecipient' }),
      push(initialNav, { name: 'enterAmount' }),
      push(initialNav, { name: 'confirm' }),
      push(initialNav, { name: 'result', result: TRANSFER }),
      push(initialNav, { name: 'failure' }),
      push(selectTab(initialNav, 'history'), { name: 'historyDetail', transferId: 't_1' }),
    ]
    for (const state of states) {
      const resolution = resolveBack(state)
      if (resolution.kind !== 'handled') continue
      expect(resolution.next, `${at(state)} 에서 back 이 아무것도 하지 않았다`).not.toEqual(state)
    }
  })

  it('resetToRoot 는 탭을 유지한다', () => {
    const nav = push(selectTab(initialNav, 'history'), { name: 'historyDetail', transferId: 't_1' })
    expect(resetToRoot(nav)).toEqual({ tab: 'history', stack: [] })
  })
})

describe('popTo', () => {
  it('그 화면이 맨 위가 될 때까지 꺼낸다', () => {
    const nav = push(
      push(push(initialNav, { name: 'enterAmount' }), { name: 'confirm' }),
      { name: 'failure' },
    )
    expect(popTo(nav, 'confirm').stack.map((s) => s.name)).toEqual(['enterAmount', 'confirm'])
    expect(popTo(nav, 'enterAmount').stack.map((s) => s.name)).toEqual(['enterAmount'])
  })

  it('없는 화면으로는 돌아가지 않는다', () => {
    const nav = push(initialNav, { name: 'confirm' })
    expect(popTo(nav, 'enterAmount')).toBe(nav)
  })

  it('이미 맨 위면 그대로다', () => {
    const nav = push(initialNav, { name: 'confirm' })
    expect(popTo(nav, 'confirm').stack.map((s) => s.name)).toEqual(['confirm'])
  })
})

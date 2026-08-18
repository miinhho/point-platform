import { describe, expect, it } from 'vitest'
import { ambiguousNames, groupHomonyms } from './useUserSearch'
import type { User } from '../domain/types'

function member(id: string, name: string, handle: string): User {
  return { id, name, handle, role: 'member' }
}

const JISOO = member('u_jisoo', '김지수', '@jisoo')
const TAEYUN = member('u_taeyun', '박태윤', '@taeyun')
const JUNHO = member('u_junho', '최준호', '@junho')
const JISU = member('u_jisu', '김지수', '@jisu')

describe('ambiguousNames', () => {
  it('겹치는 이름만 고른다', () => {
    expect(ambiguousNames([JISOO, TAEYUN, JISU])).toEqual(new Set(['김지수']))
  })

  it('겹치는 이름이 없으면 비어 있다 — 평소에는 아무 표시도 하지 않는다', () => {
    expect(ambiguousNames([JISOO, TAEYUN])).toEqual(new Set())
  })
})

describe('groupHomonyms', () => {
  it('같은 이름을 첫 등장 자리로 끌어온다', () => {
    const grouped = groupHomonyms([JISOO, TAEYUN, JUNHO, JISU])
    expect(grouped.map((u) => u.id)).toEqual(['u_jisoo', 'u_jisu', 'u_taeyun', 'u_junho'])
  })

  it('겹치지 않으면 순서를 바꾸지 않는다 — 최근 보낸 순서는 그대로여야 한다', () => {
    const users = [TAEYUN, JUNHO, JISOO]
    expect(groupHomonyms(users)).toEqual(users)
  })

  it('빈 목록도 다룬다', () => {
    expect(groupHomonyms([])).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { buildRecipientList, buildSearchList } from './recipientList'
import type { User } from '@/shared/contract'

/** `nameIsShared` 는 서버가 원장 전체에서 판정해 실어 준다 — 계약: docs/API.md */
const member = (id: string, name: string, handle: string, nameIsShared = false): User => ({
  id,
  name,
  handle,
  nameIsShared,
})

const JISOO = member('u_jisoo', '김지수', '@jisoo', true)
const JISU = member('u_jisu', '김지수', '@jisu', true)
const TAEYUN = member('u_taeyun', '박태윤', '@taeyun')
const JUNHO = member('u_junho', '최준호', '@junho')

const ALL = [JISOO, TAEYUN, JUNHO, JISU]

describe('buildRecipientList', () => {
  it('최근 묶음이 최근 순서를 지킨다', () => {
    const { recent } = buildRecipientList([TAEYUN, JUNHO], ALL)
    expect(recent.map((e) => e.user.id)).toEqual(['u_taeyun', 'u_junho'])
    expect(recent.every((e) => !e.pulledUp)).toBe(true)
  })

  // 최근/전체로 그냥 자르면 깨지는 것이 이것이다.
  it('최근에 있는 사람의 동명이인을 바로 아래로 끌어온다', () => {
    const { recent, others } = buildRecipientList([JISOO], ALL)
    expect(recent.map((e) => e.user.id)).toEqual(['u_jisoo', 'u_jisu'])
    expect(others.map((e) => e.user.id)).toEqual(['u_taeyun', 'u_junho'])
  })

  it('끌어올린 줄은 최근이 아니라고 표시한다 — 제목이 거짓말이 되면 안 된다', () => {
    const { recent } = buildRecipientList([JISOO], ALL)
    expect(recent[0].pulledUp).toBe(false)
    expect(recent[1].pulledUp).toBe(true)
  })

  it('둘 다 최근이면 끌어올림 표시가 없다', () => {
    const { recent } = buildRecipientList([JISOO, JISU], ALL)
    expect(recent.map((e) => e.pulledUp)).toEqual([false, false])
  })

  // 지갑·검색 어느 쪽이든 겹치는 둘 중 하나만 담겨 올 수 있다 — 계약: docs/API.md
  it('목록에 한 명만 있어도 서버가 겹친다고 하면 겹친다', () => {
    const { others } = buildRecipientList([], [JISOO, TAEYUN])
    expect(others.map((e) => e.user.nameIsShared)).toEqual([true, false])
  })

  it('아무도 중복되지 않으면 아무것도 끌어오지 않는다', () => {
    const { recent, others } = buildRecipientList([TAEYUN], [TAEYUN, JUNHO])
    expect(recent.map((e) => e.user.id)).toEqual(['u_taeyun'])
    expect(others.map((e) => e.user.id)).toEqual(['u_junho'])
    expect([...recent, ...others].every((e) => !e.user.nameIsShared)).toBe(true)
  })

  it('같은 사람이 두 묶음에 나오지 않는다', () => {
    const { recent, others } = buildRecipientList([JISOO, TAEYUN], ALL)
    const ids = [...recent, ...others].map((e) => e.user.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(ALL.length)
  })
})

describe('buildSearchList', () => {
  it('검색 결과에는 최근 묶음이 없고, 같은 이름은 여전히 붙어 있다', () => {
    const { recent, others } = buildSearchList([JISOO, TAEYUN, JISU])
    expect(recent).toEqual([])
    expect(others.map((e) => e.user.id)).toEqual(['u_jisoo', 'u_jisu', 'u_taeyun'])
  })
})

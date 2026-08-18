import { describe, expect, it } from 'vitest'
import { buildRecipientList, buildSearchList } from './recipientList'
import type { User } from '@/api/contract'

const member = (id: string, name: string, handle: string): User => ({ id, name, handle })

const JISOO = member('u_jisoo', '김지수', '@jisoo')
const JISU = member('u_jisu', '김지수', '@jisu')
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

  it('인원 수는 전체에서 센다 — 묶음만 세면 "같은 이름 1명"이 나온다', () => {
    const { countByName } = buildRecipientList([JISOO], ALL)
    expect(countByName.get('김지수')).toBe(2)
  })

  it('아무도 중복되지 않으면 아무것도 끌어오지 않는다', () => {
    const { recent, others } = buildRecipientList([TAEYUN], [TAEYUN, JUNHO])
    expect(recent.map((e) => e.user.id)).toEqual(['u_taeyun'])
    expect(others.map((e) => e.user.id)).toEqual(['u_junho'])
    expect([...recent, ...others].every((e) => !e.ambiguous)).toBe(true)
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

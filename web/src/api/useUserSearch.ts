import { useEffect, useState } from 'react'
import { mockApi } from './mock'
import type { User } from '../domain/types'

/**
 * 대상 검색 (여정 2).
 *
 * 이전 결과를 지우지 않고 유지한다. 글자를 하나 칠 때마다 목록이 비었다가
 * 다시 차면, 사용자는 찾던 사람이 사라졌다고 읽는다. 스피너를 넣는 것도
 * 같은 이유로 하지 않는다 — 목록이 이미 화면에 있는데 그 위에 회전하는 것을
 * 얹으면 정보가 늘지 않고 시선만 뺏는다.
 */
const DEBOUNCE_MS = 150

export interface UserSearch {
  users: User[]
  /**
   * 최근에 보낸 사람 (질의가 없을 때만).
   *
   * 목록을 최근순으로 정렬해 두는 것만으로는 부족했다 — 사용자에게는 그냥 전체
   * 목록으로 보이고, "여기 최근에 보낸 사람이 있다"는 사실이 전달되지 않는다.
   * 그래서 서버가 구분해 준 것을 별도 묶음으로 받는다.
   */
  recent: User[]
  /** 아직 한 번도 결과를 받지 못한 상태. 빈 결과와 구분해야 한다 */
  pending: boolean
}

export function useUserSearch(query: string): UserSearch {
  const [users, setUsers] = useState<User[]>([])
  const [recent, setRecent] = useState<User[]>([])
  const [pending, setPending] = useState(true)

  useEffect(() => {
    let alive = true
    void mockApi
      .recent()
      .then((result) => {
        if (alive) setRecent(result)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      void mockApi
        .users(query)
        .then((result) => {
          // 늦게 도착한 이전 질의가 새 결과를 덮어쓰지 않게 한다.
          if (!alive) return
          setUsers(result)
          setPending(false)
        })
        .catch(() => {
          if (alive) setPending(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  return { users, recent, pending }
}

/**
 * 결과 안에서 이름이 겹치는 사람들 (여정 2).
 *
 * 동명이인은 이 앱이 재현하려는 실제 위험이다. 화면은 겹칠 때만 핸들을 키워야 한다 —
 * 항상 크게 두면 검증 신호가 아니라 배경이 되어, 정작 겹치는 순간에 눈에 띄지 않는다.
 */
export function ambiguousNames(users: User[]): Set<string> {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const user of users) {
    if (seen.has(user.name)) duplicated.add(user.name)
    seen.add(user.name)
  }
  return duplicated
}

/**
 * 같은 이름을 붙여 놓는다 (여정 2).
 *
 * 핸들을 키우는 것만으로는 부족하다. 두 김지수가 목록의 1번과 9번에 떨어져 있으면
 * 사용자는 애초에 둘이 있다는 걸 모른 채 먼저 보이는 쪽을 고른다. 비교는 두 줄이
 * 눈에 함께 들어올 때만 일어난다.
 *
 * 나머지 순서(최근 보낸 순)는 건드리지 않는다. 첫 등장 자리로 같은 이름을 끌어올 뿐이다.
 */
export function groupHomonyms(users: User[]): User[] {
  const byName = new Map<string, User[]>()
  for (const user of users) {
    const group = byName.get(user.name)
    if (group) group.push(user)
    else byName.set(user.name, [user])
  }

  const emitted = new Set<string>()
  const ordered: User[] = []
  for (const user of users) {
    if (emitted.has(user.name)) continue
    emitted.add(user.name)
    ordered.push(...byName.get(user.name)!)
  }
  return ordered
}

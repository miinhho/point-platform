import type { User } from '@/shared/contract'

// 근거: docs/JOURNEY.md 여정 3. 최근 묶음과 동명이인 인접이 부딪히는 자리다.
export interface RecipientEntry {
  user: User
  /** 비교하라고 최근 묶음으로 끌어올린 줄. 없으면 제목이 거짓말이 된다. */
  pulledUp: boolean
}

export interface RecipientList {
  recent: RecipientEntry[]
  others: RecipientEntry[]
}

/**
 * 겹치는지는 서버가 답한다(`nameIsShared`). 화면이 하는 것은 겹치는 둘을
 * 나란히 놓는 것뿐이다 — 떨어져 있으면 둘이 있다는 사실 자체를 모른다.
 */
export function buildRecipientList(recent: User[], all: User[]): RecipientList {
  const recentIds = new Set(recent.map((user) => user.id))
  const emitted = new Set<string>()

  const twinsOf = (user: User): User[] =>
    user.nameIsShared
      ? all.filter((twin) => twin.name === user.name && twin.id !== user.id)
      : []

  const emit = (into: RecipientEntry[], user: User, pulledUp: boolean) => {
    if (emitted.has(user.id)) return
    emitted.add(user.id)
    into.push({ user, pulledUp })
  }

  const recentEntries: RecipientEntry[] = []
  for (const user of recent) {
    emit(recentEntries, user, false)
    // 비교는 두 줄이 함께 보일 때만 일어난다.
    for (const twin of twinsOf(user)) emit(recentEntries, twin, !recentIds.has(twin.id))
  }

  const others: RecipientEntry[] = []
  for (const user of all) {
    emit(others, user, false)
    for (const twin of twinsOf(user)) emit(others, twin, false)
  }

  return { recent: recentEntries, others }
}

/** 검색 중에는 최근 묶음을 만들지 않는다. 찾는 사람이 있는데 다른 목록이 위에 있으면 방해다. */
export function buildSearchList(results: User[]): RecipientList {
  return buildRecipientList([], results)
}

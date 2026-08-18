import type { User } from '@/domain/types'

// 근거: docs/JOURNEY.md 여정 3. 최근 묶음과 동명이인 인접이 부딪히는 자리다.
export interface RecipientEntry {
  user: User
  /** 이 결과 안에 같은 이름이 또 있는가 */
  ambiguous: boolean
  /** 비교하라고 최근 묶음으로 끌어올린 줄. 없으면 제목이 거짓말이 된다. */
  pulledUp: boolean
}

export interface RecipientList {
  recent: RecipientEntry[]
  others: RecipientEntry[]
  /** 전체에서 센다. 묶음만 세면 "같은 이름 1명" 이 나온다. */
  countByName: Map<string, number>
}

export function buildRecipientList(recent: User[], all: User[]): RecipientList {
  const countByName = new Map<string, number>()
  for (const user of all) countByName.set(user.name, (countByName.get(user.name) ?? 0) + 1)

  const isAmbiguous = (user: User) => (countByName.get(user.name) ?? 0) > 1
  const recentIds = new Set(recent.map((user) => user.id))

  const emitted = new Set<string>()
  const recentEntries: RecipientEntry[] = []

  for (const user of recent) {
    if (emitted.has(user.id)) continue
    emitted.add(user.id)
    recentEntries.push({ user, ambiguous: isAmbiguous(user), pulledUp: false })

    // 비교는 두 줄이 함께 보일 때만 일어난다.
    if (!isAmbiguous(user)) continue
    for (const twin of all) {
      if (twin.id === user.id || twin.name !== user.name || emitted.has(twin.id)) continue
      emitted.add(twin.id)
      recentEntries.push({ user: twin, ambiguous: true, pulledUp: !recentIds.has(twin.id) })
    }
  }

  const others: RecipientEntry[] = []
  for (const user of all) {
    if (emitted.has(user.id)) continue
    emitted.add(user.id)
    others.push({ user, ambiguous: isAmbiguous(user), pulledUp: false })
    if (!isAmbiguous(user)) continue
    for (const twin of all) {
      if (twin.id === user.id || twin.name !== user.name || emitted.has(twin.id)) continue
      emitted.add(twin.id)
      others.push({ user: twin, ambiguous: true, pulledUp: false })
    }
  }

  return { recent: recentEntries, others, countByName }
}

/** 검색 중에는 최근 묶음을 만들지 않는다. 찾는 사람이 있는데 다른 목록이 위에 있으면 방해다. */
export function buildSearchList(results: User[]): RecipientList {
  return buildRecipientList([], results)
}

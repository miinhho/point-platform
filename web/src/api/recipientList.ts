import type { User } from '../domain/types'

/**
 * 대상 목록 구성 (여정 2).
 *
 * 두 요구가 정면으로 부딪힌다.
 *
 *  1. **최근 보낸 사람을 먼저 보여준다.** 목록을 최근순으로 정렬해 두는 것만으로는
 *     전달되지 않는다 — 사용자에게는 그냥 전체 목록으로 보인다.
 *  2. **같은 이름은 나란히 놓는다.** 두 김지수가 떨어져 있으면 사용자는 둘이 있다는
 *     사실 자체를 모른 채 먼저 보이는 쪽을 고른다.
 *
 * 단순히 최근/전체로 자르면 2번이 깨진다. 김지수 하나는 최근에, 하나는 전체에 남는다.
 *
 * 그래서 **최근에 있는 사람의 동명이인은 최근 묶음으로 끌어올리되, "최근 아님"이라고
 * 표시한다.** 나란히 놓아 비교는 가능하게 하고, 보낸 적 없는 사람을 보낸 것처럼
 * 보이게 하지는 않는다.
 */
export interface RecipientEntry {
  user: User
  /** 이 결과 안에 같은 이름이 또 있는가 */
  ambiguous: boolean
  /**
   * 최근 묶음에 있지만 실제로 최근 대상은 아닌가.
   *
   * 동명이인이라서 비교하라고 끌어올린 줄이다. 이 표시가 없으면 "최근 보낸 사람"
   * 이라는 제목이 거짓말이 된다.
   */
  pulledUp: boolean
}

export interface RecipientList {
  recent: RecipientEntry[]
  others: RecipientEntry[]
  /** 이름별 인원 수. 묶음 안내에 쓴다 — 전체를 세지 않으면 "같은 이름 1명"이 나온다 */
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

    // 같은 이름을 가진 사람을 바로 아래로 끌어온다. 비교는 두 줄이 눈에 함께
    // 들어올 때만 일어난다.
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

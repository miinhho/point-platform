import type { User, UserId } from '@/domain/types'

/**
 * Mock 세션.
 *
 * 암호는 시드에 평문으로 둔다 — 여기는 Mock 이고, 해시를 흉내내면 진짜 인증을
 * 검증한다는 착각만 준다. 실서버가 오면 이 파일이 통째로 사라진다.
 */
const PASSWORD = 'point'

const access = new Map<string, UserId>()
/** refresh → { userId, family }. 회전하면 옛 것은 지운다 */
const refresh = new Map<string, { userId: UserId; family: string }>()
/**
 * 회전으로 물러난 refresh → 사슬.
 *
 * 지우기만 하면 그 토큰이 다시 왔을 때 어느 사슬인지 알 수 없어서 재사용을
 * 탐지할 수 없다. 훔친 토큰이 조용히 거절만 되고 진짜 사슬은 살아남는다.
 */
const retired = new Map<string, string>()
/** 재사용이 탐지된 사슬. 그 사슬의 모든 refresh 가 죽는다 */
const burned = new Set<string>()
let counter = 0

/**
 * 핸들 표기 흔들림을 서버가 흡수한다. `@` 를 빠뜨렸는지 사용자는 알 수 없고,
 * 알려 주면 어느 핸들이 존재하는지 새어 나간다.
 */
function normalize(handle: string): string {
  return `@${handle.trim().replace(/^@+/, '').toLowerCase()}`
}

export function authenticate(handle: string, password: string, users: User[]): User | null {
  if (password !== PASSWORD) return null
  const wanted = normalize(handle)
  return users.find((user) => normalize(user.handle) === wanted) ?? null
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
}

export function issueTokens(userId: UserId, family = `fam_${++counter}`): IssuedTokens {
  const accessToken = `acc_${++counter}_${userId}`
  const refreshToken = `ref_${++counter}_${userId}`
  access.set(accessToken, userId)
  refresh.set(refreshToken, { userId, family })
  return { accessToken, refreshToken }
}

/**
 * 회전. 옛 refresh 는 즉시 죽는다.
 *
 * 이미 회전된 것이 다시 오면 훔친 것으로 보고 그 사슬 전체를 무효화한다 —
 * 도둑과 주인 중 누가 먼저 왔는지 알 수 없으므로 둘 다 끊는 것이 안전하다.
 */
export function rotate(refreshToken: string): IssuedTokens | null {
  const entry = refresh.get(refreshToken)
  if (!entry) {
    return null
  }
  if (burned.has(entry.family)) return null

  refresh.delete(refreshToken)
  retired.set(refreshToken, entry.family)
  return issueTokens(entry.userId, entry.family)
}

export function burnFamily(refreshToken: string): void {
  const family = refresh.get(refreshToken)?.family ?? retired.get(refreshToken)
  if (!family) return
  burned.add(family)
  for (const [token, value] of refresh) {
    if (value.family === family) refresh.delete(token)
  }
}

/** `Authorization: Bearer <accessToken>` 에서 사용자를 찾는다. 없으면 null */
export function userIdFromHeader(header: string | null): UserId | null {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  return token ? (access.get(token) ?? null) : null
}

/** 테스트가 access 만 죽여 갱신 경로를 시험할 수 있게 한다 */
export function expireAccessTokens(): void {
  access.clear()
}

export function resetSessions(): void {
  access.clear()
  refresh.clear()
  retired.clear()
  burned.clear()
  counter = 0
}

/** 시드 사용자 전원의 암호. 화면에 적어 두어 QA 가 계정을 바꿔 볼 수 있게 한다 */
export const SEED_PASSWORD = PASSWORD

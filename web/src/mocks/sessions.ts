import type { User, UserId } from '@/domain/types'

/**
 * Mock 세션.
 *
 * 암호는 시드에 평문으로 둔다 — 여기는 Mock 이고, 해시를 흉내내면 진짜 인증을
 * 검증한다는 착각만 준다. 실서버가 오면 이 파일이 통째로 사라진다.
 */
const PASSWORD = 'point'

const tokens = new Map<string, UserId>()
let counter = 0

export function authenticate(handle: string, password: string, users: User[]): User | null {
  if (password !== PASSWORD) return null
  return users.find((user) => user.handle === handle) ?? null
}

export function issueToken(userId: UserId): string {
  const token = `tok_${++counter}_${userId}`
  tokens.set(token, userId)
  return token
}

/** `Authorization: Bearer <token>` 에서 사용자를 찾는다. 없으면 null */
export function userIdFromHeader(header: string | null): UserId | null {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  return token ? (tokens.get(token) ?? null) : null
}

export function revoke(header: string | null): void {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (token) tokens.delete(token)
}

export function resetSessions(): void {
  tokens.clear()
  counter = 0
}

/** 시드 사용자 전원의 암호. 화면에 적어 두어 QA 가 계정을 바꿔 볼 수 있게 한다 */
export const SEED_PASSWORD = PASSWORD

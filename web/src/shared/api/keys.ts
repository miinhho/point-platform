import type { PointTypeId } from '@/shared/contract'

/**
 * 캐시 키. 한 곳에 모아 두는 것은 무효화하는 쪽과 읽는 쪽이 **반드시 같은 배열**을
 * 써야 하기 때문이다 — 손으로 적으면 한 글자 차이로 무효화가 조용히 아무것도 안 한다.
 */
export const queryKeys = {
  me: ['me'] as const,
  wallet: ['wallet'] as const,
  users: (query: string, pointTypeId: PointTypeId | undefined) =>
    ['users', query, pointTypeId ?? null] as const,
  recent: (pointTypeId: PointTypeId) => ['recent', pointTypeId] as const,
  pointType: (pointTypeId: PointTypeId) => ['pointType', pointTypeId] as const,
  history: ['history'] as const,
  invites: ['invites'] as const,
  members: (pointTypeId: PointTypeId) => ['members', pointTypeId] as const,
  transfer: (transferId: string) => ['transfer', transferId] as const,
  issue: (issueId: string) => ['issue', issueId] as const,
}

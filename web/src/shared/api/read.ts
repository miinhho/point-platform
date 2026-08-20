import type { UseQueryResult } from '@tanstack/react-query'

/** 조회 하나를 화면이 읽는 모양으로 */
export interface Read<T> {
  pending: boolean
  failed: boolean
  retry: () => void
  /** **실패했으면 `null` 이다.** 아직 모르는 것과 같은 값인 것은 둘 다 답이 아니어서다 */
  data: T | null
}

/**
 * **실패했으면 직전 성공을 주지 않는다.**
 *
 * TanStack 은 재조회가 실패해도 마지막 성공 데이터를 버리지 않는다. 화면이 `data` 를
 * 먼저 보면 `isError` 를 못 보고, 그러면 **옛말을 확신에 차서 한다** — 나간 사람에게
 * 「회원 보기」와 「나가기」가 그대로 남는 것이 그것이었다(docs/FIELD.md W16).
 *
 * 실패를 빈 화면으로 두는 것이나 「아직 모른다」와 「없다」를 뭉개는 것과 같은 부류이고,
 * 셋 중 이것이 제일 나쁘다 — 앞의 둘은 사용자가 이상하다고 느끼기라도 한다.
 * 규칙: CLAUDE.md 「없는 것과 못 불러온 것을 같게 보이지 않는다」
 */
export function read<T>(query: UseQueryResult<T>): Read<T> {
  return {
    pending: query.isPending,
    failed: query.isError,
    retry: () => void query.refetch(),
    data: query.isError ? null : (query.data ?? null),
  }
}

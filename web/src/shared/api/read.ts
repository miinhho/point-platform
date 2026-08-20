import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError } from './http'

/** 조회 하나를 화면이 읽는 모양으로 */
export interface Read<T> {
  pending: boolean
  /** **모르겠다.** 다시 하면 될 수 있다 */
  failed: boolean
  /**
   * **답이다** — 이것은 너에게 없다. 다시 해도 같으므로 다시 하는 길을 주지 않는다.
   *
   * 「없다」와 「감춘다」를 서버가 일부러 같은 `404` 로 합쳤다(존재를 감추는 것이
   * 비공개의 뜻이라 갈리는 순간 존재가 샌다). 클라이언트도 가를 재료가 없다 —
   * 세션 안에서는 「방금 내가 나갔다」를 알지만 새로고침하면 모른다.
   * 계약: CLAUDE.md 「`404` 는 답이다」
   */
  absent: boolean
  retry: () => void
  /** **답이 아니면 `null` 이다.** 아직 모르는 것과 못 불러온 것이 같은 값인 이유다 */
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
  const absent = query.error instanceof ApiError && query.error.status === 404

  return {
    pending: query.isPending,
    failed: query.isError && !absent,
    absent,
    retry: () => void query.refetch(),
    data: query.isError ? null : (query.data ?? null),
  }
}

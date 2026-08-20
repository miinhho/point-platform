import { useEffect, useRef } from 'react'
import { useSetAtom } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { pointTypeQuery } from '@/shared/api'
import { replaceRouteAtom } from '@/app/atoms'
import type { PointTypeId } from '@/shared/contract'

/** 그 주소가 요구하는 것 */
export type Gate = 'issuer' | 'member'

/**
 * 권한이 걸린 주소. 막혀 있으면 은행 페이지로 **대체한다** — 계약:
 * docs/REBUILD.md 「막힌 주소는 은행 페이지로 대체한다」
 *
 * 서버가 아는 사실을 다시 계산하지 않는다. `canIssue` 와 `membership` 은 이미
 * `PointType` 에 실려 온다 — 버튼을 숨기는 것과 주소를 막는 것은 같은 값을 읽는
 * 같은 일이다.
 *
 * **들어올 때 한 번만 판정한다.** 화면에 머무는 동안 권한이 바뀌는 것(나가기)은
 * 사용자가 방금 한 일의 결과라 그 결과를 보여줘야 하고, 여기서 가로채면 「나갔다」와
 * 「원래 못 들어온다」가 같은 이동으로 보인다.
 */
export function useBankGate(pointTypeId: PointTypeId, gate: Gate): void {
  const bank = useQuery(pointTypeQuery(pointTypeId))
  const replaceRoute = useSetAtom(replaceRouteAtom)
  const decided = useRef(false)

  // 조회가 실패한 것은 「막혔다」가 아니다. 그것은 화면이 실패로 말한다.
  const open = bank.data
    ? gate === 'issuer'
      ? bank.data.canIssue
      : bank.data.membership === 'member'
    : null

  useEffect(() => {
    if (decided.current || open === null) return
    decided.current = true
    if (!open) replaceRoute({ name: 'bank', pointTypeId })
  }, [open, pointTypeId, replaceRoute])
}

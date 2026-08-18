import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { useSystemBack } from '@/shared/ui/useSystemBack'
import { backAtom } from './atoms'

/**
 * 시스템 back 을 내비게이션에 연결한다.
 *
 * 웹에서는 히스토리 덫이, WebView 안에서는 RN 의 `BackHandler`(Phase 7)가 같은
 * 함수를 부른다. back 의 의미를 정하는 곳은 `navigation.ts` 한 군데다.
 *
 * @param locked 요청이 나가는 중인가. 뮤테이션의 `isPending` 을 넘긴다
 * @returns back 을 소비했는가. false 면 셸이 기본 동작(앱 종료)을 한다
 */
export function useAppBack(locked: boolean): () => boolean {
  const back = useSetAtom(backAtom)

  const handle = useCallback(() => {
    // 'ignored' 도 소비한 것이다. 되돌릴 수 없는 구간에서 back 은 실행 취소가 아니다.
    return back(locked) !== 'exit'
  }, [back, locked])

  useSystemBack(handle)
  return handle
}

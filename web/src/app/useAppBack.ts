import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { useSystemBack } from '@/shared/ui/useSystemBack'
import { backAtom } from './atoms'

/**
 * @param locked 뮤테이션의 `isPending`.
 * @returns 소비했는가. false 면 셸이 앱을 닫는다.
 */
export function useAppBack(locked: boolean): () => boolean {
  const back = useSetAtom(backAtom)

  // 'ignored' 도 소비한 것이다.
  const handle = useCallback(() => back(locked) !== 'exit', [back, locked])

  useSystemBack(handle)
  return handle
}

import { useEffect, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { flowAtom, flowBackAtom } from '@/features/transfer'
import { navAtom, restoreNavAtom } from './atoms'
import { armFlow, navOf, primeEntry, readEntry } from './browserHistory'

/**
 * 주소와 화면을 잇는다. 셸에서 한 번만 부른다.
 *
 * 뒤로 가기는 `history.back()` 이다 — 우리가 스택을 다시 세지 않는다.
 *
 * @param locked 요청이 나가는 중인가. 이때 back 은 실행 취소가 아니다.
 */
export function useRouting(locked: boolean): void {
  const nav = useAtomValue(navAtom)
  const flow = useAtomValue(flowAtom)
  const restore = useSetAtom(restoreNavAtom)
  const flowBack = useSetAtom(flowBackAtom)

  // 리스너는 한 번만 등록한다. 화면마다 다시 걸면 등록·해제가 back 과 경합한다.
  const now = useRef({ locked, open: flow !== null, nav })
  now.current = { locked, open: flow !== null, nav }

  // 주소로 들어왔다. 첫 항목에는 state 가 없으므로 여기서 채운다.
  useEffect(() => {
    const entered = readEntry().nav
    restore(entered)
    primeEntry(entered)
  }, [restore])

  // 흐름은 주소가 없다. 항목 하나를 놓아 두어야 back 이 흐름 안에서 소비된다.
  const open = flow !== null
  useEffect(() => {
    if (open) armFlow(now.current.nav)
  }, [open])

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const { locked: busy, open: inFlow, nav: current } = now.current

      // 요청이 나가는 중에는 아무것도 하지 않는다. 화면을 벗어나면 사용자가
      // 돈의 위치를 알 수 없게 되고, 취소로 오해할 수도 있다.
      if (busy) {
        armFlow(current)
        return
      }

      if (inFlow) {
        // 되돌릴 곳이 있으면 흐름 안에서 한 단계, 없으면 흐름이 닫히고 그 아래
        // 주소가 그대로 드러난다 — 은행에서 시작한 이체를 물리면 은행으로 온다.
        if (flowBack()) armFlow(current)
        return
      }

      restore(navOf(event.state) ?? readEntry().nav)
    }

    addEventListener('popstate', onPopState)
    return () => removeEventListener('popstate', onPopState)
  }, [flowBack, restore])
}

import { useEffect, useRef } from 'react'

const TRAP = '__backTrap'

function armTrap(): void {
  // StrictMode 의 이중 실행과 연속 back 모두에서 덫이 겹쳐 쌓이지 않게 한다.
  if ((history.state as Record<string, unknown> | null)?.[TRAP]) return
  history.pushState({ [TRAP]: true }, '')
}

/**
 * @param onBack back 을 소비했으면 true. false 면 셸(브라우저·RN)이 기본 동작을 한다.
 */
export function useSystemBack(onBack: () => boolean): void {
  // 리스너는 한 번만 등록한다. 화면이 바뀔 때마다 다시 등록하면 그때마다 덫을
  // 새로 놓게 되고, 히스토리가 화면 수만큼 쌓여서 결국 라우터가 되어 버린다.
  const handler = useRef(onBack)
  useEffect(() => {
    handler.current = onBack
  }, [onBack])

  useEffect(() => {
    armTrap()

    function onPopState() {
      if (handler.current()) {
        armTrap()
        return
      }
      // 소비하지 않았다. 덫은 이미 튀었으므로 한 칸 더 물러나면 앱을 떠난다.
      history.back()
    }

    addEventListener('popstate', onPopState)
    return () => removeEventListener('popstate', onPopState)
  }, [])
}

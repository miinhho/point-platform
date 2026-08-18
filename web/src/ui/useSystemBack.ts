import { useEffect, useRef } from 'react'

/**
 * 시스템 back 을 상태 기계에 연결한다.
 *
 * 웹에서 back 은 히스토리 back 이다. 이 앱은 라우터를 쓰지 않으므로 히스토리에
 * 아무것도 쌓이지 않고, 그래서 **어느 화면에서든 back 은 앱을 떠나 버린다.**
 * 금액을 입력하다 뒤로 가면 앱이 처음부터 다시 로드된다.
 *
 * 브라우저에서 벌어지는 일이니 "웹이라서 당연하다"고 넘길 수도 있다. 그러면 안 되는
 * 이유는 두 가지다.
 *
 *  1. 실기기 검증을 폰 브라우저로 한다. back 이 앱을 죽이면 여정 5 의 "보내는 중에는
 *     back 이 아무것도 하지 않는다"를 Phase 7 전까지 아예 확인할 수 없다.
 *  2. `resolveBack` 은 이 앱의 핵심 판단이다. 그것을 실제로 부르는 경로가 어디에도
 *     없는 상태로 두면, 상태 기계는 테스트에서만 맞는 코드가 된다.
 *
 * 방법은 히스토리에 덫을 하나 놓는 것이다. 사용자가 back 을 누르면 덫이 튀고,
 * 상태 기계가 back 을 소비했으면 덫을 다시 놓아 그 자리에 머문다. 소비하지 않았으면
 * (`exit`) 한 번 더 뒤로 보내 진짜로 나간다.
 *
 * 이것은 라우터가 아니다. 히스토리에는 화면이 쌓이지 않고 덫 하나만 있으며,
 * back 의 의미는 여전히 `resolveBack` 이 혼자 정한다.
 */
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

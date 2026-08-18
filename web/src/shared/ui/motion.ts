import { chakra } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Chakra 스타일 프롭과 motion 의 제스처를 한 요소에서 같이 쓰기 위한 어댑터.
 * 이걸 만들지 않으면 화면마다 `styled(motion.button)` 을 새로 쓰게 된다.
 *
 * `transition` 은 여기로 넘기지 않는다 — Chakra 의 CSS transition 스타일 프롭과
 * 이름이 겹친다. 전환 곡선을 지정해야 하는 요소는 `<Box asChild>` 로 감싸고
 * 안쪽에 `motion.div` 를 직접 둔다.
 */
export const MotionButton = chakra(motion.button)

/**
 * 눌림 피드백.
 *
 * 탭 하이라이트를 지웠기 때문에(WebView 흔적 제거) 눌린 것을 눈으로 알려주는 일은
 * 우리 몫이다. 크기 변화는 "지금 이걸 누르고 있다"는 상태 변화의 방향을 전달한다.
 *
 * `prefers-reduced-motion` 에서는 끈다. 대신 `:active` 배경색이 남으므로
 * 눌림 자체가 사라지지는 않는다 — 애니메이션이 유일한 정보 전달 수단이면 안 된다.
 */
export function useTapScale(): { scale: number } | undefined {
  return useReducedMotion() ? undefined : { scale: 0.97 }
}

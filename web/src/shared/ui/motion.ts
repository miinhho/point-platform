import { chakra } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Chakra 스타일 프롭과 motion 제스처를 한 요소에서 쓴다.
 * `transition` 은 Chakra 의 스타일 프롭과 이름이 겹치므로 넘길 수 없다.
 */
export const MotionButton = chakra(motion.button)

/** 눌림 피드백. reduced-motion 에서는 `:active` 배경만 남는다. */
export function useTapScale(): { scale: number } | undefined {
  return useReducedMotion() ? undefined : { scale: 0.97 }
}

import { useState, type ReactNode } from 'react'
import { Box } from '@chakra-ui/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

interface Props {
  screenKey: string
  /** 커지면 앞으로, 작아지면 뒤로. */
  depth: number
  /**
   * 같은 묶음(목록→상세) 안의 이동. 화면을 밀지 않고 공유 요소만 움직인다.
   * 둘을 함께 켜면 `layoutId` 모션과 슬라이드가 서로 반대로 당긴다.
   */
  morphGroup?: string
  children: ReactNode
}

/** 방향 있는 화면 전환. 근거: docs/JOURNEY.md 「애니메이션은 정보를 전달할 때만」 */
export function ScreenTransition({ screenKey, depth, morphGroup, children }: Props) {
  const reduced = useReducedMotion()

  // 렌더 중에 이전 값과 비교해 방향을 정한다. effect 로 미루면 첫 프레임이
  // 지난 방향으로 움직였다가 되돌아온다.
  const [prevDepth, setPrevDepth] = useState(depth)
  const [prevGroup, setPrevGroup] = useState(morphGroup)
  const [direction, setDirection] = useState(1)
  if (prevDepth !== depth) {
    setDirection(depth > prevDepth ? 1 : -1)
    setPrevDepth(depth)
    setPrevGroup(morphGroup)
  }

  // 묶음 안에서의 이동이면 위치를 건드리지 않는다. 움직이는 것은 공유된 요소뿐이다.
  const morphing = morphGroup !== undefined && morphGroup === prevGroup

  const variants = reduced || morphing
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (d: number) => ({ x: `${d * 100}%`, opacity: 1 }),
        center: { x: '0%', opacity: 1 },
        // 나가는 화면은 덜 움직인다 — 떠나는 것이 아니라 가려지는 것이다.
        exit: (d: number) => ({ x: `${d * -30}%`, opacity: 0.5 }),
      }

  const transition = reduced
    ? { duration: 0.12 }
    : morphing
      ? { duration: 0.18 }
      : { type: 'spring' as const, stiffness: 520, damping: 44, mass: 0.8 }

  return (
    <Box position="relative" height="100%" overflow="hidden" bg="bg">
      <AnimatePresence
        initial={false}
        custom={direction}
        // 모프는 두 화면이 함께 떠 있어야 성립한다. 그 외에는 겹친 글자를 피해 'wait'.
        mode={reduced && !morphing ? 'wait' : 'sync'}
      >
        <motion.div
          key={screenKey}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          style={{ position: 'absolute', inset: 0, willChange: 'transform' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </Box>
  )
}

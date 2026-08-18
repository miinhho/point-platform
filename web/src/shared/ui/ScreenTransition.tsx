import { useState, type ReactNode } from 'react'
import { Box } from '@chakra-ui/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

/**
 * 화면 전환.
 *
 * 애니메이션이 여기서 하는 일은 **공간적 연속성**이다. 방금 있던 화면이 어디로
 * 갔는지 보이면, 돌아가는 것이 안전한 행동이라는 걸 배우게 된다. 되돌릴 수 없는
 * 행동을 앞두고 있을 때 "돌아가도 된다"는 확신은 긴장을 낮추는 유일한 수단이다.
 *
 * 그래서 방향이 있어야 한다. 앞으로 갈 때와 뒤로 갈 때 같은 방향으로 밀리면
 * 그건 장식이지 정보가 아니다.
 */
interface Props {
  /** 화면을 구분하는 키. 이 값이 바뀌면 전환이 일어난다 */
  screenKey: string
  /** 여정에서의 깊이. 증가하면 앞으로, 감소하면 뒤로 */
  depth: number
  /**
   * 같은 묶음 안에서의 이동인가.
   *
   * 목록에서 그 줄의 상세로 가는 것은 "다른 곳으로 이동"이 아니라 "누른 것이
   * 펼쳐지는 것"이다. 이때는 화면을 밀지 않는다 — `layoutId` 로 요소가 자리를
   * 옮기는 모션과 화면 슬라이드가 **같은 정보를 두고 다투기** 때문이다.
   * 실제로 둘을 함께 켜 봤더니 이름이 왼쪽으로 밀렸다가 되돌아왔다.
   */
  morphGroup?: string
  children: ReactNode
}

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

  /**
   * reduced motion 에서는 위치를 움직이지 않고 교차 페이드만 한다.
   * 이 경우 방향 정보는 사라지지만, 헤더의 뒤로 버튼과 제목이 그 정보를 이미
   * 가지고 있으므로 전환만으로 전달되던 것이 없다.
   */
  const variants = reduced || morphing
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        // 들어오는 화면은 진행 방향의 반대쪽 화면 밖에서 온다
        enter: (d: number) => ({ x: `${d * 100}%`, opacity: 1 }),
        center: { x: '0%', opacity: 1 },
        // 나가는 화면은 덜 움직인다. 뒤로 밀려 가려지는 것이지 같이 떠나는 게 아니다
        exit: (d: number) => ({ x: `${d * -30}%`, opacity: 0.5 }),
      }

  const transition = reduced
    ? { duration: 0.12 }
    : morphing
      // 모프가 주인공이므로 배경 화면의 페이드는 그보다 빨리 끝난다.
      ? { duration: 0.18 }
      : { type: 'spring' as const, stiffness: 520, damping: 44, mass: 0.8 }

  return (
    <Box position="relative" height="100%" overflow="hidden" bg="bg">
      {/*
        reduced motion 에서는 'wait' 로 바꾼다. 두 화면이 같은 자리에서 교차 페이드하면
        제목과 본문이 겹쳐 읽히는 순간이 생기는데, 위치 이동이 없으므로 어느 쪽 글자인지
        구분할 단서도 없다. 하나가 사라진 뒤에 다음이 나타나게 한다.
      */}
      <AnimatePresence
        initial={false}
        custom={direction}
        // 모프 중에는 두 화면이 반드시 함께 떠 있어야 한다. `wait` 로 두면
        // 공유 요소의 짝이 사라져서 morph 가 성립하지 않는다.
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

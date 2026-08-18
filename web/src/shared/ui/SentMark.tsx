import { chakra } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'

const Ring = chakra('div', {
  base: {
    width: '64px',
    height: '64px',
    borderRadius: 'full',
    bg: 'colorPalette.subtle',
    display: 'grid',
    placeItems: 'center',
  },
})

/**
 * 보냈다는 것을 느끼게 하는 표시.
 *
 * Lottie 를 쓰지 않는다 — 런타임과 JSON 애셋을 하나 더 들이는데, 여기서 필요한 것은
 * 선 하나가 그려지는 것뿐이다. 체크가 **그려지는 동안** 사용자는 방금 무언가가
 * 끝났다는 것을 본다. 이미 그려진 체크는 그 정보를 주지 않는다.
 *
 * 한 번만 그린다. 반복되는 축하 애니메이션은 두 번째부터 정보가 아니라 지연이다.
 */
export function SentMark() {
  const reduced = useReducedMotion()

  return (
    <Ring asChild>
      <motion.div
        initial={reduced ? false : { scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
      >
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
          <motion.path
            d="M7 15.5 12.5 21 23 10"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.32, delay: 0.06, ease: [0.4, 0, 0.2, 1] }}
            style={{ color: 'var(--chakra-colors-color-palette-fg)' }}
          />
        </svg>
      </motion.div>
    </Ring>
  )
}

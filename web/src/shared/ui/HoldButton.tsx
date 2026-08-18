import { useCallback, useRef, useState } from 'react'
import { chakra, Text } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'
import { HOLD_MS } from '@/domain/rules'

const Button = chakra('button', {
  base: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    minHeight: 'control',
    borderRadius: 'l2',
    // 바탕이 실색이고 글자가 대비색이다. 차오르는 면은 그것을 덮을 뿐이라 계속 읽힌다.
    bg: 'colorPalette.solid',
    _disabled: { opacity: 0.35, cursor: 'default' },
    // 홀드 중 스크롤과 롱프레스 메뉴가 끼어들지 않게 한다.
    touchAction: 'none',
    userSelect: 'none',
  },
})

interface Props {
  label: string
  onComplete: () => void
  disabled?: boolean
}

/** 근거: docs/JOURNEY.md 여정 5 — 홀드가 막는 것은 오터치다 */
export function HoldButton({ label, onComplete, disabled }: Props) {
  const reduced = useReducedMotion()
  const [holding, setHolding] = useState(false)
  const fired = useRef(false)

  const start = useCallback(() => {
    if (disabled) return
    fired.current = false
    setHolding(true)
  }, [disabled])

  const stop = useCallback(() => setHolding(false), [])

  return (
    <Button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        if (!event.repeat) start()
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') stop()
      }}
      onBlur={stop}
    >
      {/* 선형으로 움직인다. 이징을 넣으면 남은 시간이 실제와 어긋나 보인다. */}
      <motion.div
        animate={{ scaleX: holding ? 1 : 0 }}
        transition={
          holding
            ? { duration: HOLD_MS / 1000, ease: 'linear' }
            : { duration: reduced ? 0 : 0.18, ease: 'easeOut' }
        }
        onAnimationComplete={() => {
          if (!holding || fired.current) return
          fired.current = true
          setHolding(false)
          onComplete()
        }}
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'left',
          scaleX: 0,
          background: 'rgba(0, 0, 0, 0.3)',
        }}
      />
      <Text position="relative" textStyle="button" color="colorPalette.contrast">
        {label}
      </Text>
    </Button>
  )
}

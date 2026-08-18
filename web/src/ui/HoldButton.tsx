import { useCallback, useRef, useState } from 'react'
import { chakra, Text } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'
import { HOLD_MS } from '@/domain/rules'

/**
 * 홀드 확정 (여정 4 — 보낼지 결정한다).
 *
 * 확인 다이얼로그를 쓰지 않는다. 사용자는 이미 "확인 → 예"를 읽지 않고 누르는 습관을
 * 학습했고, 그 창은 실수를 막지 못하면서 책임만 사용자에게 넘긴다.
 *
 * 대신 홀드다. 탭은 스크롤하다 손가락이 스칠 수 있지만 홀드는 지속적인 의사표시라서
 * 실수로 하기 어렵고, 누르고 있는 동안 화면을 읽을 시간이 생긴다.
 *
 * 시간은 금액과 무관하게 일정하다 (`HOLD_MS`). 금액이 커질수록 무거워지는 설계를
 * 검토했다가 버렸다 — 홀드가 존재하는 이유는 위험도 전달이 아니라 오터치 방지다.
 *
 * 차오르는 면은 장식이 아니라 **시간의 잔량**이다. 얼마나 더 누르고 있어야 하는지
 * 모르면 사용자는 중간에 손을 뗀다.
 */
interface Props {
  label: string
  /** 홀드가 끝까지 갔을 때. 손을 떼면 부르지 않는다 */
  onComplete: () => void
  tone?: 'transfer' | 'issue'
  disabled?: boolean
}

export function HoldButton({ label, onComplete, tone = 'transfer', disabled }: Props) {
  const reduced = useReducedMotion()
  const [holding, setHolding] = useState(false)
  // 완료 후의 리셋 애니메이션이 완료 콜백을 한 번 더 부르지 않게 한다.
  const fired = useRef(false)

  const start = useCallback(() => {
    if (disabled) return
    fired.current = false
    setHolding(true)
  }, [disabled])

  const stop = useCallback(() => setHolding(false), [])

  const isIssue = tone === 'issue'

  return (
    <chakra.button
      type="button"
      aria-label={`${label} — 꾹 누른다`}
      disabled={disabled}
      position="relative"
      overflow="hidden"
      width="100%"
      minHeight="56px"
      borderRadius="l2"
      // 바탕이 이미 실색이고 글자는 그 위의 대비색이다. 차오르는 면은 그것을 더
      // 어둡게 덮을 뿐이라, 채워지는 도중에도 글자가 계속 읽힌다.
      bg={isIssue ? 'issue.solid' : 'blue.solid'}
      _disabled={{ opacity: 0.35, cursor: 'default' }}
      // 홀드 중 스크롤이나 롱프레스 메뉴가 끼어들지 않게 한다.
      css={{ touchAction: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // 키보드 경로. 스페이스를 누르고 있는 동안이 홀드다.
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          if (!event.repeat) start()
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') stop()
      }}
      onBlur={stop}
    >
      {/*
        선형으로 움직인다. 여기에 이징을 넣으면 남은 시간이 실제와 어긋나 보이고,
        그러면 사용자는 곧 끝날 것 같은 순간에 손을 뗀다.
      */}
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

      <Text
        position="relative"
        fontSize="md"
        fontWeight="medium"
        color={isIssue ? 'issue.contrast' : 'blue.contrast'}
      >
        {label}
      </Text>
    </chakra.button>
  )
}

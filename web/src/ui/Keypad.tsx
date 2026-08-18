import { useRef } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { MotionButton, useTapScale } from './motion'

/**
 * 금액 키패드 (여정 3).
 *
 * 시스템 키보드를 쓰지 않는 이유는 두 가지다. 화면 절반을 덮어서 방금 입력한
 * 금액이 가려지고, 소수점·문자 키가 있어서 이 화면에서 불가능한 입력을 제안한다.
 *
 * **만** 키를 넣었다가 뺐다. 탭 수를 줄이는 것이 목적이었는데, 실제로 자주 일어나는
 * 일은 "많이 쳤다가 처음부터 다시 치는 것"이었다. 지우기를 길게 누르는 숨은 제스처로
 * 그것을 처리하게 두면, 발견하지 못한 사용자는 열세 번을 눌러 지운다.
 * 그래서 자리를 **전체삭제**에 준다 — 숨은 제스처를 눈에 보이는 키로 바꾼 것이다.
 */
export interface KeypadProps {
  onDigit: (digit: string) => void
  onBackspace: () => void
  /** 전체삭제. 지우기 롱프레스로도 부른다 */
  onClear: () => void
  disabled?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** 지우기를 전부 지우기로 승격시키는 홀드 시간. */
const CLEAR_HOLD_MS = 500

export function Keypad({ onDigit, onBackspace, onClear, disabled }: KeypadProps) {
  const tap = useTapScale()
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleared = useRef(false)

  function startHold() {
    cleared.current = false
    holdTimer.current = setTimeout(() => {
      cleared.current = true
      onClear()
    }, CLEAR_HOLD_MS)
  }

  function endHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
    // 홀드로 이미 전부 지웠으면 한 글자를 또 지우지 않는다.
    if (!cleared.current) onBackspace()
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
    cleared.current = true
  }

  return (
    <Box
      display="grid"
      gridTemplateColumns="repeat(3, 1fr)"
      gap="1"
      paddingInline="gutter"
      paddingBottom="2"
    >
      {DIGITS.map((digit) => (
        <Key key={digit} tap={tap} disabled={disabled} onClick={() => onDigit(digit)}>
          {digit}
        </Key>
      ))}

      <Key tap={tap} disabled={disabled} onClick={onClear} muted small>
        전체삭제
      </Key>
      <Key tap={tap} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </Key>
      <Key
        tap={tap}
        disabled={disabled}
        muted
        aria-label="지우기 (길게 누르면 전부)"
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
      >
        ⌫
      </Key>
    </Box>
  )
}

interface KeyProps {
  children: React.ReactNode
  tap: { scale: number } | undefined
  muted?: boolean
  /** 글자 키. 숫자보다 작게 둔다 */
  small?: boolean
  disabled?: boolean
  onClick?: () => void
  onPointerDown?: () => void
  onPointerUp?: () => void
  onPointerLeave?: () => void
  onPointerCancel?: () => void
  'aria-label'?: string
}

function Key({ children, tap, muted, small, ...rest }: KeyProps) {
  return (
    <MotionButton
      type="button"
      whileTap={tap}
      // 키는 손가락 크기로 잡는다. 여기서 아끼면 오타가 늘고, 오타를 막으려고
      // 만든 화면이 오타를 만든다.
      minHeight="56px"
      borderRadius="l2"
      fontSize={small ? 'sm' : muted ? 'lg' : '2xl'}
      fontWeight="medium"
      fontVariantNumeric="tabular-nums"
      color={muted ? 'fg.muted' : 'fg'}
      _active={{ bg: 'bg.muted' }}
      _disabled={{ opacity: 0.4 }}
      {...rest}
    >
      {typeof children === 'string' ? <Text as="span">{children}</Text> : children}
    </MotionButton>
  )
}

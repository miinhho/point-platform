import { useRef } from 'react'
import { Box, chakra } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** 지우기를 전부 지우기로 승격시키는 홀드 시간. */
const CLEAR_HOLD_MS = 500

const Key = chakra('button', {
  base: {
    // 실기기 실측에서 60px 이 오타 없이 눌렸다 (FIELD.md R2-7).
    minHeight: 'key',
    borderRadius: 'l2',
    textStyle: 'key',
    color: 'fg',
    _active: { bg: 'bg.muted' },
  },
  variants: { glyph: { true: { textStyle: 'keyGlyph', color: 'fg.muted' } } },
})

interface Props {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
}

/** 근거: docs/JOURNEY.md 여정 4 */
export function Keypad({ onDigit, onBackspace, onClear }: Props) {
  const { t } = useTranslation()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleared = useRef(false)

  function hold() {
    cleared.current = false
    timer.current = setTimeout(() => {
      cleared.current = true
      onClear()
    }, CLEAR_HOLD_MS)
  }

  function release(commit: boolean) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (commit && !cleared.current) onBackspace()
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
        <Key key={digit} type="button" onClick={() => onDigit(digit)}>
          {digit}
        </Key>
      ))}

      <Key type="button" glyph onClick={onClear}>
        {t('amount.clear')}
      </Key>
      <Key type="button" onClick={() => onDigit('0')}>
        0
      </Key>
      <Key
        type="button"
        glyph
        aria-label={t('amount.backspace')}
        onPointerDown={hold}
        onPointerUp={() => release(true)}
        onPointerLeave={() => release(false)}
        onPointerCancel={() => release(false)}
      >
        ⌫
      </Key>
    </Box>
  )
}

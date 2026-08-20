import { useRef } from 'react'
import { Box, Button } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** 지우기를 전부 지우기로 승격시키는 홀드 시간. */
const CLEAR_HOLD_MS = 500

/** 실기기 실측에서 60px 이 오타 없이 눌렸다 (FIELD.md R2-7). */
function Key({
  glyph,
  children,
  ...rest
}: React.ComponentProps<typeof Button> & { glyph?: boolean }) {
  return (
    <Button
      variant="ghost"
      height="key"
      borderRadius="panel"
      textStyle={glyph ? 'keyGlyph' : 'key'}
      color={glyph ? 'fg.muted' : 'fg'}
      {...rest}
    >
      {children}
    </Button>
  )
}

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
      gap="bond"
      paddingInline="gutter"
      paddingBottom="tight"
    >
      {DIGITS.map((digit) => (
        <Key key={digit} onClick={() => onDigit(digit)}>
          {digit}
        </Key>
      ))}

      <Key glyph onClick={onClear}>
        {t('amount.clear')}
      </Key>
      <Key onClick={() => onDigit('0')}>0</Key>
      <Key
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

import { Box, Text } from '@chakra-ui/react'
import { label, UNIT_SYMBOL } from '@/domain/points'
import type { Points } from '@/domain/types'

/**
 * 금액 표기 (여정 3 · 4).
 *
 * `verify` 를 켜면 숫자와 한글을 나란히 둔다. 자릿수 오타(150만 → 1500만)는
 * 숫자만 보면 놓치지만 "백오십만"과 "천오백만"은 다르게 읽힌다.
 *
 * 두 표기는 검증을 돕기 위한 것이므로, 검증할 것이 있는 자리에만 켠다.
 * 이미 확정된 내역 목록에서는 켜지 않는다 — 모든 줄에 한글이 붙으면 노이즈가 되어
 * 정작 검증이 필요한 자리에서 눈에 띄지 않는다.
 */
export type AmountSize = 'display' | 'medium' | 'small'

interface Props {
  value: Points
  size?: AmountSize
  /** 사용자가 확정해야 하는 금액인가 */
  verify?: boolean
  /** 부호. 내역에서 들어온 돈과 나간 돈을 구분한다 */
  sign?: 'in' | 'out'
  /**
   * 일어나지 않은 금액인가 (취소·실패).
   *
   * 확정된 것과 같은 무게로 두면 목록에서 둘이 구분되지 않고, 사용자는
   * 취소한 이체를 나간 돈으로 읽는다.
   */
  muted?: boolean
}

const NUMERIC_STYLE: Record<AmountSize, string> = {
  display: 'amount',
  medium: 'amountSmall',
  small: 'md',
}

export function Amount({ value, size = 'medium', verify = false, sign, muted }: Props) {
  const parts = label(value)
  const prefix = sign === 'in' ? '+' : sign === 'out' ? '−' : ''

  return (
    <Box display="flex" flexDirection="column" gap="0.5" minW={0}>
      <Text
        textStyle={NUMERIC_STYLE[size]}
        // 'small' 은 textStyle 이 아니라 fontSize 라서 굵기를 여기서 정한다
        fontWeight={size === 'small' ? 'medium' : undefined}
        fontVariantNumeric="tabular-nums"
        color={muted ? 'fg.subtle' : sign === 'in' ? 'green.fg' : 'fg'}
        textDecoration={muted ? 'line-through' : undefined}
        whiteSpace="nowrap"
      >
        {prefix}
        {parts.grouped}
        <Text
          as="span"
          ml="1"
          fontSize={size === 'display' ? '0.5em' : '0.72em'}
          fontWeight="medium"
          color="fg.muted"
        >
          {UNIT_SYMBOL}
        </Text>
      </Text>

      {verify && parts.koreanWithUnit ? (
        <Text fontSize={size === 'display' ? 'md' : 'sm'} color="fg.muted" whiteSpace="nowrap">
          {parts.koreanWithUnit}
        </Text>
      ) : null}
    </Box>
  )
}

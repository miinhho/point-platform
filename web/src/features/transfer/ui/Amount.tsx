import { Box, Text } from '@chakra-ui/react'
import { label } from '@/domain/points'
import type { PointType, Points } from '@/domain/types'
import { amountFontSize } from '@/shared/ui/amountFit'

interface Props {
  pointType: PointType
  amount: Points
  /** 상한을 넘었는가. 숫자와 한글이 함께 붉어진다 */
  over?: boolean
}

/** 근거: docs/JOURNEY.md 여정 4 — 금액만 단독으로 보여주는 화면을 만들지 않는다 */
export function Amount({ pointType, amount, over }: Props) {
  const parts = label(amount)
  const tone = over ? 'red.fg' : undefined

  return (
    <Box colorPalette={pointType.accent}>
      <Text textStyle="label" color="colorPalette.fg">
        {pointType.name}
      </Text>

      <Text
        textStyle="amount"
        // discipline-allow: 크기가 자릿수로 정해지는 유일한 자리다 (shared/ui/amountFit.ts)
        fontSize={amountFontSize(parts.grouped)}
        color={tone ?? (amount === 0 ? 'fg.subtle' : 'fg')}
        whiteSpace="nowrap"
      >
        {parts.grouped}
      </Text>

      {/* 자리를 비워 두어 첫 글자에서 화면이 튀지 않게 한다. */}
      <Text textStyle="support" color={tone} css={{ minHeight: '1.5em' }} wordBreak="keep-all">
        {parts.short}
      </Text>
    </Box>
  )
}

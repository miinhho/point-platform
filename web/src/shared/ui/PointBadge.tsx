import { Box } from '@chakra-ui/react'

/**
 * 색과 기호를 함께 주는 표식. 회색조에서도 기호로 갈린다 — docs/JOURNEY.md 여정 1.
 * 색은 바깥의 `colorPalette` 를 따른다.
 */
export function PointBadge({ symbol }: { symbol: string }) {
  return (
    <Box
      aria-hidden
      flexShrink={0}
      boxSize="avatar"
      borderRadius="l2"
      bg="colorPalette.subtle"
      color="colorPalette.fg"
      borderWidth="1px"
      borderColor="colorPalette.muted"
      display="grid"
      placeItems="center"
      textStyle="badge"
    >
      {symbol}
    </Box>
  )
}

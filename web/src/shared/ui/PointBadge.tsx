import { Box } from '@chakra-ui/react'

/**
 * 색과 표식을 함께 주는 배지. 회색조에서도 갈린다 — docs/JOURNEY.md 여정 1.
 * 이모지는 모양으로 갈리므로 색을 빼도 오히려 더 잘 갈린다.
 *
 * 글자였을 때는 `color` 토큰이 표식을 칠했지만 이모지는 자체 색이 있어 그 토큰이
 * 아무 일도 하지 않는다. 그래서 색은 바탕과 테두리만 맡는다.
 *
 * 글꼴 대체를 타므로 `textStyle` 로 크기를 잡으면 기기마다 다르게 보인다 —
 * 상자 크기에 대한 비율로 고정한다.
 */
export function PointBadge({ emoji }: { emoji: string }) {
  return (
    <Box
      aria-hidden
      flexShrink={0}
      boxSize="avatar"
      borderRadius="panel"
      bg="colorPalette.subtle"
      borderWidth="1px"
      borderColor="colorPalette.muted"
      display="grid"
      placeItems="center"
      css={{ fontSize: '55%', lineHeight: 1 }}
    >
      {emoji}
    </Box>
  )
}

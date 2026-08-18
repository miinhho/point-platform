import { Box, chakra, Text } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'
import { useColorMode, type ColorModePreference } from '@/components/ui/color-mode'

/**
 * 색 모드 3택.
 *
 * 라이트↔다크 토글이 아니라 3택인 이유는 `components/ui/color-mode.tsx` 에 있다 —
 * 2택으로 만들면 한 번 누른 사용자가 시스템 따르기로 돌아갈 방법을 잃는다.
 *
 * 선택 표시가 미끄러져 이동하는 것은 장식이 아니다. 어느 칸에서 어느 칸으로
 * 갔는지 보이면 지금 무엇이 선택되어 있는지 색 대비만으로 판단하지 않아도 된다.
 * 다크 모드를 고르는 순간 화면 전체 색이 뒤집히므로, 그때 위치 정보가 남아 있는
 * 편이 안전하다.
 */
const OPTIONS: { value: ColorModePreference; label: string }[] = [
  { value: 'system', label: '자동' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]

export function ColorModeSelect() {
  const { preference, setPreference } = useColorMode()
  const reduced = useReducedMotion()

  return (
    <Box
      role="radiogroup"
      aria-label="색 모드"
      display="flex"
      padding="2px"
      bg="bg.muted"
      borderRadius="full"
      flexShrink={0}
    >
      {OPTIONS.map((option) => {
        const selected = preference === option.value
        return (
          <chakra.button
            type="button"
            key={option.value}
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(option.value)}
            position="relative"
            paddingInline="2.5"
            paddingBlock="1"
            borderRadius="full"
          >
            {selected ? (
              <Box asChild position="absolute" inset={0} borderRadius="full" bg="bg.panel" boxShadow="xs">
                <motion.div
                  layoutId="colorModeThumb"
                  transition={
                    reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }
                  }
                />
              </Box>
            ) : null}
            <Text
              position="relative"
              fontSize="xs"
              fontWeight={selected ? 'medium' : 'normal'}
              color={selected ? 'fg' : 'fg.muted'}
            >
              {option.label}
            </Text>
          </chakra.button>
        )
      })}
    </Box>
  )
}

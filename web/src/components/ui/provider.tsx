'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { system } from '@/ui/system'
import { ColorModeProvider, type ColorModeProviderProps } from './color-mode'

/**
 * Chakra CLI 스니펫에서 `defaultSystem` 을 우리 `system` 으로 바꾼 것.
 * 이 한 줄이 바뀌지 않으면 `ui/system.ts` 의 토큰은 아무 데도 적용되지 않는다.
 */
export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  )
}

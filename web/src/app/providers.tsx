import type { ReactNode } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/shared/i18n'
import { system } from '@/shared/ui/system'
import { createQueryClient } from './queryClient'
import { ColorModeProvider } from './color-mode'

// 상태 소유권: CLAUDE.md 「상태의 소유권을 섞지 않는다」
const queryClient = createQueryClient()
const store = createStore()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <I18nextProvider i18n={i18n}>
          <ChakraProvider value={system}>
            <ColorModeProvider>{children}</ColorModeProvider>
          </ChakraProvider>
        </I18nextProvider>
      </JotaiProvider>
    </QueryClientProvider>
  )
}

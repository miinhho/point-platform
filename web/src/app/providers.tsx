import type { ReactNode } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/shared/i18n'
import { system } from '@/shared/ui/system'
import { createQueryClient } from './queryClient'
import { ColorModeProvider } from './color-mode'

/**
 * 프로바이더.
 *
 * 상태의 책임이 둘로 갈린다. **TanStack Query 는 서버가 진실인 것**(잔액·사용자·
 * 포인트 종류·내역)을, **Jotai 는 클라이언트가 진실인 것**(어디에 있는가, 무엇을
 * 보내는 중인가)을 맡는다. 이 경계가 흐려지면 같은 값이 두 곳에 있게 되고,
 * 둘 중 하나는 반드시 낡는다.
 *
 * 스토어와 쿼리 클라이언트를 모듈 최상단에서 만들지 않고 여기서 만드는 것은
 * 테스트가 매번 깨끗한 것을 받을 수 있게 하려는 것이다.
 */
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

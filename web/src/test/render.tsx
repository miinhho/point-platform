import type { ReactNode } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { I18nextProvider } from 'react-i18next'
import { render, type RenderResult } from '@testing-library/react'
import { endpoints } from '@/api/endpoints'
import { setTokens } from '@/api/http'
import { i18n } from '@/shared/i18n'
import { system } from '@/shared/ui/system'

/** 매번 새 캐시·스토어를 준다. 테스트끼리 상태가 새면 순서에 따라 결과가 달라진다. */
export function renderApp(ui: ReactNode): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={createStore()}>
        <I18nextProvider i18n={i18n}>
          <ChakraProvider value={system}>{ui}</ChakraProvider>
        </I18nextProvider>
      </JotaiProvider>
    </QueryClientProvider>,
  )
}

/**
 * 화면 테스트가 로그인 화면을 매번 지나지 않게 토큰만 미리 심는다.
 * 로그인 자체는 `features/auth` 테스트가 화면으로 확인한다.
 */
export async function signInAs(handle = '@minho'): Promise<{ userId: string }> {
  const session = await endpoints.login({ handle, password: 'point' })
  setTokens(session)
  return { userId: session.user.id }
}

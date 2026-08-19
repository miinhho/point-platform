import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from '@/app/providers'
import App from '@/app/App'

/** 워커 등록 전에 렌더하면 첫 요청들이 가로채이기 전에 나가 404 가 된다. */
async function startMockServer(): Promise<void> {
  // 실서버에 붙을 때는 가로채지 않는다. Mock 이 답하면 서버와 갈린 자리를 못 본다.
  if (!import.meta.env.DEV || import.meta.env.VITE_API_ORIGIN) return
  const { worker } = await import('@/mocks/browser')
  await worker.start({
    // 정적 자원은 통과시키고 /api 만 막는다.
    onUnhandledRequest: (request, print) => {
      if (new URL(request.url).pathname.startsWith('/api')) print.error()
    },
    quiet: true,
  })
}

void startMockServer().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers>
        <App />
      </Providers>
    </StrictMode>,
  )
})

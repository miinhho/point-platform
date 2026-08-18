import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from '@/app/providers'
import App from '@/app/App'

/** 워커 등록 전에 렌더하면 첫 요청들이 가로채이기 전에 나가 404 가 된다. */
async function startMockServer(): Promise<void> {
  if (!import.meta.env.DEV) return
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

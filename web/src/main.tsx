import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from '@/app/providers'
import App from '@/app/App'

/**
 * Mock 서버를 먼저 띄운다.
 *
 * 워커 등록을 기다리지 않고 렌더하면 첫 요청들이 가로채이기 전에 나가서 404 가 된다.
 * 그 실패는 앱의 잘못이 아니라 부팅 순서의 문제인데, 화면에는 "서버 오류"로 보인다.
 *
 * 서비스 워커는 보안 컨텍스트에서만 등록된다. 실기기에서는 LAN IP 대신
 * `adb reverse` 로 `localhost` 를 써야 한다 (`docs/API.md` 참조).
 */
async function startMockServer(): Promise<void> {
  if (!import.meta.env.DEV) return
  const { worker } = await import('@/mocks/browser')
  await worker.start({
    // 계약에 없는 요청은 조용히 통과시키지 않는다. 다만 정적 자원은 예외다.
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

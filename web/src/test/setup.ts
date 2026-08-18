import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/mocks/node'
import { resetLedger } from '@/mocks/ledger'
import { resetSim, setSim } from '@/mocks/sim'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(async () => {
  // RTL 자동 정리는 vitest `globals: true` 에서만 켜진다. 없으면 이전 렌더의 DOM 이
  // 남아서 다음 테스트가 낡은 화면을 읽는다.
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
  server.resetHandlers()
  resetLedger()
  resetSim()
  setSim({ latencyMs: 0, jitterMs: 0 })
})

afterAll(() => {
  server.close()
})

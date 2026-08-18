import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/mocks/node'
import { resetLedger } from '@/mocks/ledger'
import { resetSim, setSim } from '@/mocks/sim'

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' })
  // 스프링 전환과 MSW 왕복이 겹치면 기본 1초로는 부하에 따라 갈린다.
  if (typeof document !== 'undefined') {
    const { configure } = await import('@testing-library/react')
    configure({ asyncUtilTimeout: 5_000 })
  }
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

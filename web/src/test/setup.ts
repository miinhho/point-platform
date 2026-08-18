import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/mocks/node'
import { resetLedger } from '@/mocks/ledger'
import { resetSim, setSim } from '@/mocks/sim'

/**
 * 테스트는 앱과 **같은 MSW 핸들러**를 쓴다.
 *
 * 그래서 이 테스트가 검증하는 것은 인메모리 객체가 아니라 실제 HTTP 계약이다 —
 * 상태 코드, `Idempotency-Key` 헤더, 네트워크 실패까지 같은 경로를 지난다.
 */
beforeAll(() => {
  // 핸들러에 없는 요청은 조용히 통과시키지 않는다. 계약에 없는 호출은 실패해야 한다.
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  resetLedger()
  resetSim()
  // 테스트에서 지연은 소음이다. 지연 자체를 검증할 때만 켠다.
  setSim({ latencyMs: 0, jitterMs: 0 })
})

afterAll(() => {
  server.close()
})

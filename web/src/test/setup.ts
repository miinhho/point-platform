import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { server } from '@/mocks/node'
import { resetLedger } from '@/mocks/ledger'
import { resetSessions } from '@/mocks/sessions'
import { resetSim, setSim } from '@/mocks/sim'
import { setTokens } from '@/api/http'

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' })
  // 파일 20여 개가 동시에 도는 전체 실행에서는 기본 1초로 부하에 따라 갈린다.
  if (typeof document !== 'undefined') {
    const { configure } = await import('@testing-library/react')
    configure({ asyncUtilTimeout: 10_000 })
  }
})

/*
 * 지연을 여기서 끈다. `afterEach` 에서만 끄면 **파일마다 첫 테스트만** 기본
 * 지연(400~600ms)으로 돌고 나머지는 0 이었다 — 전체 실행의 부하에서 첫 테스트가
 * 먼저 넘어지는 이유였다. 조건이 같아야 결과가 조건을 말한다.
 */
beforeEach(() => {
  resetSim()
  setSim({ latencyMs: 0, jitterMs: 0 })
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
  resetSessions()
  setTokens(null)
})

afterAll(() => {
  server.close()
})

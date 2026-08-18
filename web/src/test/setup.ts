import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/mocks/node'
import { resetLedger } from '@/mocks/ledger'
import { resetSim, setSim } from '@/mocks/sim'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  resetLedger()
  resetSim()
  setSim({ latencyMs: 0, jitterMs: 0 })
})

afterAll(() => {
  server.close()
})

import { delay, http, HttpResponse } from 'msw'
import type { FailureCode } from '@/domain/types'
import * as ledger from './ledger'
import { drawFailure, drawResponseLoss, simulatedLatency } from './sim'

// 계약: docs/API.md
const STATUS: Record<FailureCode, number> = {
  INSUFFICIENT_BALANCE: 422,
  CAP_EXCEEDED: 422,
  NOT_ISSUER: 403,
  RECIPIENT_NOT_FOUND: 404,
  POINT_TYPE_NOT_FOUND: 404,
  NETWORK: 599,
  SERVER: 500,
}

function fail(code: FailureCode) {
  return HttpResponse.json({ code }, { status: STATUS[code] })
}

/** `NETWORK` 는 응답이 아니라 전송 실패다. 그 차이가 "결과를 알 수 없다"를 만든다. */
async function gate(): Promise<Response | null> {
  await delay(simulatedLatency())
  const injected = drawFailure()
  if (!injected) return null
  if (injected === 'NETWORK') return HttpResponse.error()
  return fail(injected)
}

interface TransferBody {
  pointTypeId?: string
  toId?: string
  amount?: number
}

function readKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key')
}

async function commit(
  request: Request,
  apply: (input: ledger.CommitInput) => ReturnType<typeof ledger.commitTransfer>,
  /** 발행은 대상을 받지 않는다. 자기 지갑으로만 들어간다 */
  selfOnly = false,
) {
  const blocked = await gate()
  if (blocked) return blocked

  const key = readKey(request)
  // 키 없는 쓰기를 받아 주면 이중 이체가 조용히 가능해진다.
  if (!key) return HttpResponse.json({ code: 'SERVER', message: 'Idempotency-Key 없음' }, { status: 400 })

  const existing = ledger.findByIdempotencyKey(key)
  if (existing) return HttpResponse.json(existing)

  const body = (await request.json()) as TransferBody
  const toId = selfOnly ? ledger.ME : body.toId
  // 발행 요청에 대상이 실려 오면 계약 위반이다. 조용히 무시하지 않는다.
  const malformed =
    !body.pointTypeId || !toId || !body.amount || body.amount <= 0 || (selfOnly && body.toId)
  if (malformed) {
    return HttpResponse.json({ code: 'SERVER', message: '요청 형식 오류' }, { status: 400 })
  }

  try {
    const transfer = apply({
      idempotencyKey: key,
      pointTypeId: body.pointTypeId!,
      toId: toId!,
      amount: body.amount!,
    })
    // 서버는 만들었고 클라이언트는 못 받는다. 멱등성이 실제로 시험되는 유일한 경로다.
    if (drawResponseLoss()) return HttpResponse.error()
    return HttpResponse.json(transfer, { status: 201 })
  } catch (error) {
    if (error instanceof ledger.LedgerError) return fail(error.code)
    throw error
  }
}

export const handlers = [
  http.get('*/api/me', async () => (await gate()) ?? HttpResponse.json(ledger.me())),

  http.get('*/api/wallet', async () => {
    const blocked = await gate()
    return (
      blocked ??
      HttpResponse.json({ user: ledger.me(), balances: ledger.balancesOf('u_minho') })
    )
  }),

  http.get('*/api/point-types', async () => (await gate()) ?? HttpResponse.json(ledger.allPointTypes())),

  http.get('*/api/users', async ({ request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const query = new URL(request.url).searchParams.get('q')
    return HttpResponse.json(ledger.searchUsers(query))
  }),

  http.get('*/api/recent', async ({ request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const params = new URL(request.url).searchParams
    const pointTypeId = params.get('pointTypeId')
    if (!pointTypeId) return fail('POINT_TYPE_NOT_FOUND')
    return HttpResponse.json(ledger.recentFor(pointTypeId, Number(params.get('limit') ?? 4)))
  }),

  http.post('*/api/transfers', ({ request }) => commit(request, ledger.commitTransfer)),
  http.post('*/api/issues', ({ request }) => commit(request, ledger.commitIssue, true)),

  http.get('*/api/transfers/by-key', async ({ request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const key = new URL(request.url).searchParams.get('idempotencyKey')
    if (!key) return HttpResponse.json({ code: 'SERVER' }, { status: 400 })
    // 없으면 404 가 아니라 null 이다. "안 일어났다" 는 정상적인 답이다.
    return HttpResponse.json(ledger.findByIdempotencyKey(key) ?? null)
  }),

  http.get('*/api/transfers/:id', async ({ params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const transfer = ledger.findTransfer(String(params.id))
    // 없다는 것은 일어나지 않았다는 뜻이다.
    if (!transfer) return HttpResponse.json({ code: 'SERVER', message: '없음' }, { status: 404 })
    return HttpResponse.json(transfer)
  }),

  http.get('*/api/transfers', async ({ request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const params = new URL(request.url).searchParams
    return HttpResponse.json(
      ledger.history(params.get('pointTypeId'), Number(params.get('limit') ?? 30)),
    )
  }),
]

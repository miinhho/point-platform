import { delay, http, HttpResponse } from 'msw'
import type { FailureCode } from '@/domain/types'
import * as ledger from './ledger'
import { drawFailure, simulatedLatency } from './sim'

/**
 * MSW 핸들러 — 계약의 서버 쪽.
 *
 * 계약은 TypeScript 인터페이스가 아니라 HTTP 다. 그래서 여기서 실제로 상태 코드와
 * 헤더를 다룬다. 앱은 진짜 `fetch` 를 하고, Spring Boot 가 오면 이 파일만 지운다.
 *
 * 멱등성 키는 **헤더**로 받는다. 본문 필드로 받으면 재시도 판정이 본문 스키마에 묶인다.
 */
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

/**
 * 모든 요청 앞에 붙는 지연과 주입된 실패.
 *
 * `NETWORK` 는 응답을 만들지 않고 **전송 자체를 실패시킨다**. 서버가 준 오류 응답과
 * 요청이 닿지 못한 것은 클라이언트에게 전혀 다른 상황이고, 그 차이를 흉내내면
 * "결과를 알 수 없다"를 검증할 수 없다.
 */
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
) {
  const blocked = await gate()
  if (blocked) return blocked

  const key = readKey(request)
  // 멱등성 키 없는 쓰기를 받지 않는다. 받아 주면 클라이언트가 키를 빼먹었을 때
  // 조용히 이중 이체가 가능해지고, 그건 배포된 뒤에 발견된다.
  if (!key) return HttpResponse.json({ code: 'SERVER', message: 'Idempotency-Key 없음' }, { status: 400 })

  const existing = ledger.findByIdempotencyKey(key)
  if (existing) return HttpResponse.json(existing)

  const body = (await request.json()) as TransferBody
  if (!body.pointTypeId || !body.toId || !body.amount || body.amount <= 0) {
    return HttpResponse.json({ code: 'SERVER', message: '요청 형식 오류' }, { status: 400 })
  }

  try {
    const transfer = apply({
      idempotencyKey: key,
      pointTypeId: body.pointTypeId,
      toId: body.toId,
      amount: body.amount,
    })
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
  http.post('*/api/issues', ({ request }) => commit(request, ledger.commitIssue)),

  http.get('*/api/transfers/:id', async ({ params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const transfer = ledger.findTransfer(String(params.id))
    // 없다는 것은 일어나지 않았다는 뜻이다. 결과를 알 수 없던 요청의 답이 된다.
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

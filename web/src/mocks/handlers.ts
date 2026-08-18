import { delay, http, HttpResponse } from 'msw'
import type { FailureCode, PointAccent } from '@/api/contract'
import * as ledger from './ledger'
import { authenticate, burnFamily, issueTokens, rotate, userIdFromHeader } from './sessions'
import { drawFailure, drawResponseLoss, simulatedLatency } from './sim'

// 계약: docs/API.md
const STATUS: Record<FailureCode, number> = {
  BAD_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  INSUFFICIENT_BALANCE: 422,
  CAP_EXCEEDED: 422,
  NOT_ISSUER: 403,
  RECIPIENT_NOT_FOUND: 404,
  POINT_TYPE_NOT_FOUND: 404,
  SYMBOL_TAKEN: 409,
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

/**
 * 토큰에서 요청자를 찾는다. 없으면 401 이다.
 *
 * 모든 읽기·쓰기가 이걸 통과한다 — 인증을 화면마다 확인하면 한 곳이 빠지고,
 * 빠진 곳이 남의 잔액을 보여준다.
 */
function requireUser(request: Request): { userId: string } | Response {
  const userId = userIdFromHeader(request.headers.get('Authorization'))
  if (!userId) return fail('UNAUTHENTICATED')
  return { userId }
}

interface TransferBody {
  pointTypeId?: string
  toId?: string
  amount?: number
}

function readKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key')
}

/** 형식은 HTTP 경계가 본다. 통과하지 못하면 원장을 부르지 않는다 — 계약: docs/API.md */
function readCommitBody(
  body: TransferBody,
  meId: string,
  selfOnly: boolean,
): Omit<ledger.CommitInput, 'idempotencyKey'> | null {
  const toId = selfOnly ? meId : body.toId
  if (!body.pointTypeId || !toId) return null
  // 발행 요청에 대상이 실려 오면 계약 위반이다. 조용히 무시하지 않는다.
  if (selfOnly && body.toId) return null
  // 발행은 자기 지갑으로 들어가지만, 이체는 옮길 곳이 없다 — docs/JOURNEY.md 「버린 것」
  if (!selfOnly && toId === meId) return null
  // 타입은 컴파일 시점만 지킨다. HTTP 경계에는 타입이 없다 — 소수점 금액이 들어오면
  // 잔액에 소수가 생기고, 한글 병기가 그것을 조용히 버려 두 표기가 다른 값을 말한다.
  const { amount } = body
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return null
  return { pointTypeId: body.pointTypeId, toId, amount }
}

async function commit(
  request: Request,
  apply: (meId: string, input: ledger.CommitInput) => ReturnType<typeof ledger.commitTransfer>,
  /** 발행은 대상을 받지 않는다. 자기 지갑으로만 들어간다 */
  selfOnly = false,
) {
  const blocked = await gate()
  if (blocked) return blocked

  const auth = requireUser(request)
  if (auth instanceof Response) return auth

  const key = readKey(request)
  // 키 없는 쓰기를 받아 주면 이중 이체가 조용히 가능해진다.
  if (!key) return HttpResponse.json({ code: 'SERVER', message: 'Idempotency-Key 없음' }, { status: 400 })

  const existing = ledger.findByIdempotencyKey(key)
  if (existing) return HttpResponse.json(existing)

  const input = readCommitBody((await request.json()) as TransferBody, auth.userId, selfOnly)
  if (!input) {
    return HttpResponse.json({ code: 'SERVER', message: '요청 형식 오류' }, { status: 400 })
  }

  try {
    const transfer = apply(auth.userId, { ...input, idempotencyKey: key })
    // 서버는 만들었고 클라이언트는 못 받는다. 멱등성이 실제로 시험되는 유일한 경로다.
    if (drawResponseLoss()) return HttpResponse.error()
    return HttpResponse.json(transfer, { status: 201 })
  } catch (error) {
    if (error instanceof ledger.LedgerError) return fail(error.code)
    throw error
  }
}

interface CreatePointTypeBody {
  name?: unknown
  symbol?: unknown
  accent?: unknown
  issueCap?: unknown
}

const ACCENTS: readonly PointAccent[] = ['blue', 'green', 'purple', 'orange', 'pink', 'teal']

/**
 * 형식은 HTTP 경계가 본다 — 계약: docs/API.md 여정 9 절.
 * 통과하지 못하면 원장을 부르지 않는다.
 */
function readCreateBody(body: CreatePointTypeBody): ledger.CreatePointTypeInput | null {
  const { name, symbol, accent, issueCap } = body
  if (typeof name !== 'string' || typeof symbol !== 'string') return null
  if (name.trim().length < 1 || name.trim().length > 12) return null
  if (!/^[A-Za-z]{2,3}$/.test(symbol)) return null
  if (typeof accent !== 'string' || !ACCENTS.includes(accent as PointAccent)) return null
  if (typeof issueCap !== 'number' || !Number.isSafeInteger(issueCap) || issueCap <= 0) return null
  return { idempotencyKey: '', name, symbol, accent: accent as PointAccent, issueCap }
}

/** 인증이 필요한 읽기. 한 곳에서만 토큰을 확인한다 */
function authed(handle: (userId: string, request: Request) => unknown) {
  return async ({ request }: { request: Request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth
    const result = handle(auth.userId, request)
    return result instanceof Response ? result : HttpResponse.json(result as never)
  }
}

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const { handle, password } = (await request.json()) as { handle?: string; password?: string }
    const user = authenticate(handle ?? '', password ?? '', ledger.allUsers())
    if (!user) return fail('BAD_CREDENTIALS')
    return HttpResponse.json({ ...issueTokens(user.id), user })
  }),

  http.post('*/api/point-types', async ({ request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth

    const key = readKey(request)
    // 창설도 되돌릴 수 없다. 응답을 못 받고 다시 눌러도 하나만 생겨야 한다.
    if (!key) {
      return HttpResponse.json({ code: 'SERVER', message: 'Idempotency-Key 없음' }, { status: 400 })
    }

    const input = readCreateBody((await request.json()) as CreatePointTypeBody)
    if (!input) {
      return HttpResponse.json({ code: 'SERVER', message: '요청 형식 오류' }, { status: 400 })
    }

    try {
      const created = ledger.createPointType(auth.userId, { ...input, idempotencyKey: key })
      if (drawResponseLoss()) return HttpResponse.error()
      return HttpResponse.json(created, { status: 201 })
    } catch (error) {
      if (error instanceof ledger.LedgerError) return fail(error.code)
      throw error
    }
  }),

  http.post('*/api/auth/refresh', async ({ request }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const { refreshToken } = (await request.json()) as { refreshToken?: string }
    const next = refreshToken ? rotate(refreshToken) : null
    // 이미 회전된 것이 왔다는 것은 훔친 것일 수 있다. 사슬 전체를 끊는다.
    if (!next) {
      if (refreshToken) burnFamily(refreshToken)
      return fail('UNAUTHENTICATED')
    }
    return HttpResponse.json(next)
  }),

  http.post('*/api/auth/logout', async ({ request }) => {
    const { refreshToken } = (await request.json().catch(() => ({}))) as { refreshToken?: string }
    if (refreshToken) burnFamily(refreshToken)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/me', authed((userId) => ledger.userById(userId)!)),

  http.get(
    '*/api/wallet',
    authed((userId) => ({ user: ledger.userById(userId)!, balances: ledger.balancesOf(userId) })),
  ),

  http.get('*/api/point-types', authed((userId) => ledger.pointTypesFor(userId))),

  http.get(
    '*/api/users',
    authed((userId, request) =>
      ledger.searchUsers(new URL(request.url).searchParams.get('q'), userId),
    ),
  ),

  http.get(
    '*/api/recent',
    authed((_userId, request) => {
      const params = new URL(request.url).searchParams
      const pointTypeId = params.get('pointTypeId')
      if (!pointTypeId) return fail('POINT_TYPE_NOT_FOUND')
      return ledger.recentFor(pointTypeId, Number(params.get('limit') ?? 4))
    }),
  ),

  http.post('*/api/transfers', ({ request }) => commit(request, ledger.commitTransfer)),
  http.post('*/api/issues', ({ request }) => commit(request, ledger.commitIssue, true)),

  http.get(
    '*/api/transfers/by-key',
    authed((_userId, request) => {
      const key = new URL(request.url).searchParams.get('idempotencyKey')
      if (!key) return HttpResponse.json({ code: 'SERVER' }, { status: 400 })
      // 없으면 404 가 아니라 null 이다. "안 일어났다" 는 정상적인 답이다.
      return ledger.findByIdempotencyKey(key) ?? null
    }),
  ),

  http.get('*/api/transfers/:id', async ({ request, params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth
    const transfer = ledger.findTransfer(String(params.id))
    // 없다는 것은 일어나지 않았다는 뜻이다.
    if (!transfer) return HttpResponse.json({ code: 'SERVER', message: '없음' }, { status: 404 })
    return HttpResponse.json(transfer)
  }),

  http.get(
    '*/api/transfers',
    authed((userId, request) => {
      const params = new URL(request.url).searchParams
      return ledger.history(userId, params.get('pointTypeId'), Number(params.get('limit') ?? 30))
    }),
  ),
]

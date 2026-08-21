import { delay, http, HttpResponse } from 'msw'
import { ALLOWED_EMOJI } from '@/shared/contract'
import type { FailureCode, FailureOutcome, PointAccent, PointVisibility } from '@/shared/contract'
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
  ISSUER_CANNOT_LEAVE: 409,
  NOT_MEMBER: 403,
  ALREADY_MEMBER: 409,
  INVITE_NOT_FOUND: 404,
  NOT_A_PRIVATE_BANK: 404,
  UNKNOWN_ENDPOINT: 404,
  RECIPIENT_NOT_FOUND: 404,
  POINT_TYPE_NOT_FOUND: 404,
  CAP_BELOW_ISSUED: 422,
  MALFORMED_REQUEST: 400,
  TRANSFER_NOT_FOUND: 404,
  NETWORK: 599,
  SERVER: 500,
}

/**
 * 결과를 아는지는 서버가 말한다 — 계약: docs/API.md. 원장이 던지는 실패는 전부
 * 반영 전에 걸리므로 `none` 이다. `unknown` 은 시뮬레이션이 만들어 내는 것뿐이다.
 */
function fail(code: FailureCode, outcome: FailureOutcome = 'none') {
  return HttpResponse.json({ code, outcome }, { status: STATUS[code] })
}

const malformed = () => fail('MALFORMED_REQUEST')

/** `NETWORK` 는 응답이 아니라 전송 실패다. 그 차이가 "결과를 알 수 없다"를 만든다. */
async function gate(): Promise<Response | null> {
  await delay(simulatedLatency())
  const injected = drawFailure()
  if (!injected) return null
  if (injected === 'NETWORK') return HttpResponse.error()
  // 주입된 서버 오류는 어디까지 갔는지 모르는 실패를 흉내내는 것이다.
  return fail(injected, injected === 'SERVER' ? 'unknown' : 'none')
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
): Omit<ledger.CommitInput, 'idempotencyKey'> | null {
  const toId = body.toId
  if (!body.pointTypeId || !toId) return null
  // 자기에게 보낼 곳이 없다 — docs/JOURNEY.md 「버린 것」
  if (toId === meId) return null
  // 타입은 컴파일 시점만 지킨다. HTTP 경계에는 타입이 없다 — 소수점 금액이 들어오면
  // 잔액에 소수가 생기고, 한글 병기가 그것을 조용히 버려 두 표기가 다른 값을 말한다.
  const { amount } = body
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return null
  return { pointTypeId: body.pointTypeId, toId, amount }
}

async function commitTransfer(request: Request) {
  const blocked = await gate()
  if (blocked) return blocked

  const auth = requireUser(request)
  if (auth instanceof Response) return auth

  const key = readKey(request)
  // 키 없는 쓰기를 받아 주면 이중 이체가 조용히 가능해진다.
  if (!key) return malformed()

  const existing = ledger.findByIdempotencyKey(key, auth.userId)
  if (existing) return HttpResponse.json(existing)

  const input = readCommitBody((await request.json()) as TransferBody, auth.userId)
  if (!input) return malformed()

  try {
    const transfer = ledger.commitTransfer(auth.userId, { ...input, idempotencyKey: key })
    // 서버는 만들었고 클라이언트는 못 받는다. 멱등성이 실제로 시험되는 유일한 경로다.
    if (drawResponseLoss()) return HttpResponse.error()
    return HttpResponse.json(transfer, { status: 201 })
  } catch (error) {
    if (error instanceof ledger.LedgerError) return fail(error.code)
    throw error
  }
}

/** 발행은 대상을 받지 않는다. 응답도 `Transfer` 가 아니라 `Issue` 다 — 계약: docs/API.md */
async function commitIssue(request: Request) {
  const blocked = await gate()
  if (blocked) return blocked

  const auth = requireUser(request)
  if (auth instanceof Response) return auth

  const key = readKey(request)
  if (!key) return malformed()

  const existing = ledger.findIssueByKey(key, auth.userId)
  if (existing) return HttpResponse.json(existing)

  const body = (await request.json()) as TransferBody
  // 발행 요청에 대상이 실려 오면 계약 위반이다. 조용히 무시하지 않는다.
  if (!body.pointTypeId || body.toId) return malformed()
  const { amount } = body
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return malformed()

  try {
    const issue = ledger.commitIssue(auth.userId, {
      idempotencyKey: key,
      pointTypeId: body.pointTypeId,
      amount,
    })
    if (drawResponseLoss()) return HttpResponse.error()
    return HttpResponse.json(issue, { status: 201 })
  } catch (error) {
    if (error instanceof ledger.LedgerError) return fail(error.code)
    throw error
  }
}

interface CreatePointTypeBody {
  name?: unknown
  emoji?: unknown
  description?: unknown
  accent?: unknown
  issueCap?: unknown
  visibility?: unknown
}

const ACCENTS: readonly PointAccent[] = [
  'blue',
  'green',
  'purple',
  'orange',
  'pink',
  'teal',
  'amber',
  'rose',
  'indigo',
  'lime',
]
const VISIBILITIES: readonly PointVisibility[] = ['public', 'private']

/**
 * 형식은 HTTP 경계가 본다 — 계약: docs/API.md 여정 9 절.
 * 통과하지 못하면 원장을 부르지 않는다.
 */
function readCreateBody(body: CreatePointTypeBody): ledger.CreatePointTypeInput | null {
  const { name, emoji, description, accent, issueCap, visibility } = body
  if (typeof name !== 'string' || typeof emoji !== 'string') return null
  if (name.trim().length < 1 || name.trim().length > 12) return null
  // 허용 목록 안의 값만 받는다. 자유 입력을 받으면 기기마다 다르게 보이는 것이 들어온다.
  if (!(ALLOWED_EMOJI as readonly string[]).includes(emoji)) return null
  // 없어도 만들 수 있다. 「없음」은 `null` 하나로 정규화한다 — 빈 문자열과 둘로 두면
  // 한쪽만 보는 코드가 생기고, 그 코드는 한쪽 서버에서만 터진다.
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return null
  }
  if (typeof description === 'string' && description.trim().length > 60) return null
  if (typeof accent !== 'string' || !ACCENTS.includes(accent as PointAccent)) return null
  if (typeof issueCap !== 'number' || !Number.isSafeInteger(issueCap) || issueCap <= 0) return null
  // 나중에 바꿀 수 없는 값이다. 빠지면 기본값을 정하지 않고 거절한다.
  if (typeof visibility !== 'string' || !VISIBILITIES.includes(visibility as PointVisibility)) {
    return null
  }
  return {
    idempotencyKey: '',
    name,
    emoji,
    description: typeof description === 'string' ? description.trim() || null : null,
    accent: accent as PointAccent,
    issueCap,
    visibility: visibility as PointVisibility,
  }
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
    if (!key) return malformed()

    const input = readCreateBody((await request.json()) as CreatePointTypeBody)
    if (!input) return malformed()

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

  // 은행 페이지. 내 지갑에 없는 포인트도 소개는 보인다 — 계약: docs/API.md
  http.get(
    '*/api/point-types/:id',
    authed((userId, request) => {
      const id = new URL(request.url).pathname.split('/').pop()!
      return ledger.findPointType(id, userId) ?? fail('POINT_TYPE_NOT_FOUND')
    }),
  ),

  http.get(
    '*/api/users',
    authed((userId, request) => {
      const params = new URL(request.url).searchParams
      return ledger.searchUsers(params.get('q'), userId, params.get('pointTypeId'))
    }),
  ),

  http.get(
    '*/api/recent',
    authed((userId, request) => {
      const params = new URL(request.url).searchParams
      const pointTypeId = params.get('pointTypeId')
      if (!pointTypeId) return fail('POINT_TYPE_NOT_FOUND')
      return ledger.recentFor(pointTypeId, userId, Number(params.get('limit') ?? 4))
    }),
  ),

  http.post('*/api/transfers', ({ request }) => commitTransfer(request)),
  http.post('*/api/issues', ({ request }) => commitIssue(request)),

  http.get(
    '*/api/issues/by-key',
    authed((userId, request) => {
      const key = new URL(request.url).searchParams.get('idempotencyKey')
      if (!key) return malformed()
      return ledger.findIssueByKey(key, userId) ?? null
    }),
  ),

  http.get('*/api/issues/:id', async ({ request, params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth
    const issue = ledger.findIssue(String(params.id), auth.userId)
    if (!issue) return fail('TRANSFER_NOT_FOUND')
    return HttpResponse.json(issue)
  }),

  http.get(
    '*/api/transfers/by-key',
    authed((userId, request) => {
      const key = new URL(request.url).searchParams.get('idempotencyKey')
      if (!key) return malformed()
      // 없으면 404 가 아니라 null 이다. "안 일어났다" 는 정상적인 답이다.
      // 남의 것도 null 이다 — 없을 때와 구별되면 그것이 곧 존재한다는 답이 된다.
      return ledger.findByIdempotencyKey(key, userId) ?? null
    }),
  ),

  http.get('*/api/transfers/:id', async ({ request, params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth
    const transfer = ledger.findTransfer(String(params.id), auth.userId)
    // 없다는 것은 일어나지 않았다는 뜻이다. 남의 것도 같은 답이다 —
    // 403 으로 가르면 그 id 가 존재한다는 것을 알려 주는 셈이다.
    if (!transfer) return fail('TRANSFER_NOT_FOUND')
    return HttpResponse.json(transfer)
  }),

  http.get('*/api/invites', authed((userId) => ledger.invitesFor(userId))),

  http.get(
    '*/api/point-types/:id/members',
    authed((userId, request) => {
      const [, pointTypeId] = new URL(request.url).pathname.match(/point-types\/([^/]+)\/members/)!
      try {
        return ledger.membersOf(pointTypeId, userId)
      } catch (error) {
        if (error instanceof ledger.LedgerError) return fail(error.code)
        throw error
      }
    }),
  ),

  http.delete('*/api/point-types/:id/members/:userId', async ({ request, params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth

    const target = String(params.userId) === 'me' ? auth.userId : String(params.userId)
    try {
      ledger.removeMember(auth.userId, String(params.id), target)
      if (drawResponseLoss()) return HttpResponse.error()
      return new HttpResponse(null, { status: 204 })
    } catch (error) {
      if (error instanceof ledger.LedgerError) return fail(error.code)
      throw error
    }
  }),

  http.post('*/api/point-types/:id/invites', async ({ request, params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth

    const key = readKey(request)
    // 같은 키로 다시 오면 초대가 둘 생기면 안 된다.
    if (!key) return malformed()

    // 이체가 `toId` 를 받는 것과 같다 — 화면은 검색해서 고른 사람을 보낸다.
    const { userId } = (await request.json()) as { userId?: unknown }
    if (typeof userId !== 'string' || !userId) return malformed()

    try {
      const invited = ledger.invite(auth.userId, String(params.id), userId, key)
      if (drawResponseLoss()) return HttpResponse.error()
      return HttpResponse.json(invited, { status: 201 })
    } catch (error) {
      if (error instanceof ledger.LedgerError) return fail(error.code)
      throw error
    }
  }),

  http.post('*/api/point-types/:id/invites/accept', async ({ request, params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth

    try {
      const joined = ledger.acceptInvite(auth.userId, String(params.id))
      if (drawResponseLoss()) return HttpResponse.error()
      return HttpResponse.json(joined)
    } catch (error) {
      if (error instanceof ledger.LedgerError) return fail(error.code)
      throw error
    }
  }),

  // 이체와 상한 변경을 서버가 섞어서 준다 — 계약: docs/API.md
  http.get(
    '*/api/history',
    authed((userId, request) => {
      const params = new URL(request.url).searchParams
      return ledger.history(userId, params.get('pointTypeId'), Number(params.get('limit') ?? 30))
    }),
  ),

  http.patch('*/api/point-types/:id/cap', async ({ request, params }) => {
    const blocked = await gate()
    if (blocked) return blocked
    const auth = requireUser(request)
    if (auth instanceof Response) return auth

    const key = readKey(request)
    // 이력에 남는 사건이다. 응답을 못 받고 다시 눌러도 두 줄이 생기면 안 된다.
    if (!key) return malformed()

    const { issueCap } = (await request.json()) as { issueCap?: unknown }
    if (typeof issueCap !== 'number' || !Number.isSafeInteger(issueCap) || issueCap <= 0) {
      return malformed()
    }

    // 같은 값은 400 이다 — 아무것도 바꾸지 않는 줄을 이력에 남기지 않는다.
    // 다만 재시도보다 뒤에 본다. 응답을 못 받고 다시 누르면 상한은 이미 새 값이라,
    // 순서를 바꾸면 성공한 요청이 400 으로 돌아온다.
    const current = ledger.pointTypesFor(auth.userId).find((type) => type.id === String(params.id))
    if (!ledger.findCapChangeByKey(key) && current?.issueCap === issueCap) return malformed()

    try {
      const changed = ledger.changeCap(auth.userId, String(params.id), issueCap, key)
      if (drawResponseLoss()) return HttpResponse.error()
      return HttpResponse.json(changed)
    } catch (error) {
      if (error instanceof ledger.LedgerError) return fail(error.code)
      throw error
    }
  }),

  /*
   * 없는 경로도 계약 본문으로 답한다 — 계약: docs/API.md 「실패」. 프레임워크 기본
   * 404 가 새면 `code` 도 `outcome` 도 없어 화면이 「결과를 알 수 없다」로 읽는다.
   * 실서버가 실제로 그 상태였다(docs/FIELD.md W7). 반드시 맨 뒤에 둔다 —
   * MSW 는 먼저 맞는 핸들러를 쓰므로 앞에 두면 모든 경로를 삼킨다.
   */
  http.all('*/api/*', () => fail('UNKNOWN_ENDPOINT')),
]

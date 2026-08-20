import { FAILURE_CODES, type FailureCode, type FailureOutcome } from '@/shared/contract'

// 계약: docs/API.md

// 노드 `fetch` 는 절대 URL 만 받는다. 테스트에는 origin 이 없으므로 여기서 채운다.
const ORIGIN = globalThis.location?.origin ?? 'http://localhost'
const BASE_URL = `${ORIGIN}/api`

export class ApiError extends Error {
  readonly code: FailureCode
  readonly status: number | null
  /** 서버가 답한 것. 응답이 오지 않았을 때만 클라이언트가 `unknown` 으로 친다 */
  readonly outcome: FailureOutcome

  constructor(code: FailureCode, message: string, status: number | null, outcome: FailureOutcome) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.outcome = outcome
  }

  /** 화면이 단정하지 않아야 하는 경우다 */
  get outcomeUnknown(): boolean {
    return this.outcome === 'unknown'
  }
}

const KNOWN_CODES = new Set<string>(FAILURE_CODES)

interface ErrorBody {
  code?: string
  outcome?: string
  message?: string
}

/**
 * 토큰.
 *
 * 메모리에만 둔다 — `localStorage` 에 두면 XSS 한 번에 샌다. 새로고침하면 다시
 * 로그인하는 것이 그 대가다.
 */
interface Tokens {
  accessToken: string
  refreshToken: string
}

let tokens: Tokens | null = null

export function setTokens(next: Tokens | null): void {
  tokens = next
}

export function hasTokens(): boolean {
  return tokens !== null
}

/** 나갈 때 서버에 무효화를 알리기 위해 한 번 꺼낸다. 꺼내면 클라이언트에는 남지 않는다. */
export function takeRefreshToken(): string | null {
  const value = tokens?.refreshToken ?? null
  tokens = null
  return value
}

/** 401 을 받으면 화면이 로그인으로 가야 한다. 그 통로를 여기 둔다 */
let onUnauthenticated: (() => void) | null = null

export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler
}

/**
 * access 가 만료되면 refresh 로 한 번 갱신하고 원요청을 다시 보낸다.
 *
 * 갱신은 한 번에 하나만 돈다. 화면 여럿이 동시에 401 을 받으면 refresh 가 여러 번
 * 나가고, 회전 때문에 뒤엣것들이 재사용으로 탐지돼 세션이 통째로 죽는다.
 */
let refreshing: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false
  refreshing ??= (async () => {
    try {
      const next = await request<Tokens>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: tokens!.refreshToken },
        skipRefresh: true,
      })
      tokens = next
      return true
    } catch {
      tokens = null
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** `Idempotency-Key` 헤더로 나간다. */
  idempotencyKey?: string
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
  /** 갱신 요청 자체. 401 을 받아도 다시 갱신하지 않는다 */
  skipRefresh?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, query, signal, skipRefresh } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    // 중단은 실패가 아니므로 그대로 흘린다.
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    // 응답이 오지 않았다. 서버가 말할 수 없는 유일한 경우라 여기서만 클라이언트가 정한다.
    throw new ApiError('NETWORK', '요청이 서버에 닿지 못했습니다', null, 'unknown')
  }

  if (response.ok) {
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  }

  const parsed = await response
    .json()
    .then((value) => value as ErrorBody)
    .catch(() => ({}) as ErrorBody)

  // 서버가 준 코드를 우선하고, 없으면 상태 코드로 떨어진다.
  const code: FailureCode =
    parsed.code && KNOWN_CODES.has(parsed.code) ? (parsed.code as FailureCode) : 'SERVER'

  // 결과를 아는지는 서버가 답한다. 말하지 않았으면 단정하지 않는다.
  const outcome: FailureOutcome = parsed.outcome === 'none' ? 'none' : 'unknown'

  if (code === 'UNAUTHENTICATED' && !skipRefresh) {
    // 멱등성 키가 있으므로 원요청 재시도가 안전하다. 그 키를 헤더로 둔 값이 여기서 난다.
    if (await refreshTokens()) return request<T>(path, options)
    onUnauthenticated?.()
  }

  throw new ApiError(code, parsed.message ?? '서버가 요청을 처리하지 못했습니다', response.status, outcome)
}

/** 이체마다 하나. 재시도는 같은 키를 다시 쓴다. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

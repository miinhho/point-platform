import type { FailureCode } from '@/domain/types'

// 계약: docs/API.md

// 노드 `fetch` 는 절대 URL 만 받는다. 테스트에는 origin 이 없으므로 여기서 채운다.
const ORIGIN = globalThis.location?.origin ?? 'http://localhost'
const BASE_URL = `${ORIGIN}/api`

export class ApiError extends Error {
  readonly code: FailureCode
  readonly status: number | null
  /** 서버가 요청을 처리했는지 알 수 없는가. 화면이 단정하지 않아야 하는 경우다. */
  readonly outcomeUnknown: boolean

  constructor(code: FailureCode, message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.outcomeUnknown = code === 'NETWORK' || code === 'SERVER'
  }
}

const FAILURE_CODES = new Set<string>([
  'INSUFFICIENT_BALANCE',
  'CAP_EXCEEDED',
  'NOT_ISSUER',
  'RECIPIENT_NOT_FOUND',
  'POINT_TYPE_NOT_FOUND',
  'NETWORK',
  'SERVER',
])

interface ErrorBody {
  code?: string
  message?: string
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** `Idempotency-Key` 헤더로 나간다. */
  idempotencyKey?: string
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, query, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

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
    throw new ApiError('NETWORK', '요청이 서버에 닿지 못했습니다', null)
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
    parsed.code && FAILURE_CODES.has(parsed.code) ? (parsed.code as FailureCode) : 'SERVER'

  throw new ApiError(code, parsed.message ?? '서버가 요청을 처리하지 못했습니다', response.status)
}

/** 이체마다 하나. 재시도는 같은 키를 다시 쓴다. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

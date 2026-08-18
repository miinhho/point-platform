import type { FailureCode } from '@/domain/types'

/**
 * HTTP 클라이언트.
 *
 * 계약은 TypeScript 인터페이스가 아니라 **HTTP** 다. 처음에는 Mock 을 로컬 모듈로
 * 두고 화면이 그것을 직접 부르게 했는데, 그러면 실서버를 붙이는 날 클라이언트 계층을
 * 처음부터 새로 쓰게 된다 — 멱등성 키가 헤더가 아니라 JS 객체 필드였고,
 * "네트워크 실패"는 진짜 실패가 아니라 로컬에서 던진 예외였다.
 *
 * 지금은 앱이 실제 `fetch` 를 하고, 개발 중에는 MSW 가 그것을 가로챈다.
 * Spring Boot 가 오면 핸들러만 지우면 되고 이 파일은 그대로 남는다.
 */
/**
 * `fetch` 는 노드에서 절대 URL 만 받는다. 브라우저에는 origin 이 있고 테스트에는 없으므로
 * 그 차이를 여기서 한 번 흡수한다 — 호출부가 환경을 알아야 하면 그건 클라이언트가
 * 자기 일을 안 한 것이다.
 */
const ORIGIN = globalThis.location?.origin ?? 'http://localhost'
const BASE_URL = `${ORIGIN}/api`

export class ApiError extends Error {
  readonly code: FailureCode
  readonly status: number | null
  /**
   * 요청이 성립했는지 클라이언트가 알 수 없는가.
   *
   * 네트워크가 끊기거나 서버가 5xx 를 주면 서버가 요청을 처리했는지 알 수 없다.
   * 이때 "실패했습니다"라고 단정하면 거짓말이 될 수 있다. 화면은 추측하지 않고
   * 그렇게 말해야 한다 — 멱등성 키가 있으므로 재시도는 안전하다.
   */
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
  /**
   * 멱등성 키. **헤더로 보낸다.**
   *
   * 본문 필드로 보내면 서버가 본문을 파싱해야 키를 알 수 있고, 그러면 재시도 판정이
   * 본문 스키마에 묶인다. 결제 API 들이 헤더를 쓰는 이유가 이것이다.
   */
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
    // 요청이 서버에 닿았는지 알 수 없는 유일한 경우다. 중단은 실패가 아니다.
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

  // 서버가 준 코드를 우선한다. 상태 코드는 그것이 없을 때의 대비책이다.
  const code: FailureCode =
    parsed.code && FAILURE_CODES.has(parsed.code) ? (parsed.code as FailureCode) : 'SERVER'

  throw new ApiError(code, parsed.message ?? '서버가 요청을 처리하지 못했습니다', response.status)
}

/** 이체마다 하나. 확정 화면에 들어갈 때 만들고 재시도는 같은 키를 다시 쓴다. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

// API 계약. docs/API.md 가 근거 문서다.
//
// Mock 서버와 실서버(Spring Boot + Kotlin + MySQL)가 이 인터페이스를 구현한다.
// 클라이언트는 PointApi 에만 의존하므로, 교체는 구현체를 바꾸는 것으로 끝난다.

import type {
  Account,
  FailureCode,
  Ledger,
  Points,
  Transfer,
  User,
  UserId,
} from '../domain/types'

/**
 * 이체 요청.
 *
 * idempotencyKey 는 클라이언트가 생성한다. 이체는 되돌릴 수 없으므로(헌법 23조)
 * 네트워크 재시도로 인한 이중 이체가 치명적이다. 같은 키로 재요청하면 서버는
 * 새 이체를 만들지 않고 기존 것을 반환한다.
 *
 * 키는 확정 화면에 진입할 때 한 번 생성하고, 재시도 버튼은 같은 키를 재사용한다.
 */
export interface CreateTransferInput {
  idempotencyKey: string
  toId: UserId
  amount: Points
  memo?: string
}

export interface CreateIssueInput {
  idempotencyKey: string
  toId: UserId
  amount: Points
  memo?: string
}

/** 상태 변화 구독 해제 */
export type Unsubscribe = () => void

export interface PointApi {
  me(): Promise<Account>
  /** 검색. 질의가 없으면 전체를 최근순으로 준다 */
  users(query?: string): Promise<User[]>
  /**
   * 최근에 보낸 대상 (여정 2).
   *
   * `users()` 의 앞부분과 겹치지만 분리한다. 화면이 "최근"과 "전체"를 다른 묶음으로
   * 보여주려면 어디까지가 최근인지 알아야 하고, 그 경계는 서버만 안다.
   * 정렬 순서로 추측하면 최근 대상이 하나도 없을 때 아무나 최근인 척하게 된다.
   */
  recent(limit?: number): Promise<User[]>
  ledger(): Promise<Ledger>

  createTransfer(input: CreateTransferInput): Promise<Transfer>
  /** issuer 역할만 호출할 수 있다 */
  createIssue(input: CreateIssueInput): Promise<Transfer>

  /** confirmableAt 이전에만 성공한다 (헌법 9조) */
  cancel(transferId: string): Promise<Transfer>
  get(transferId: string): Promise<Transfer>
  history(limit?: number): Promise<Transfer[]>

  /**
   * pending → confirmed 전환을 클라이언트에 알린다.
   *
   * Mock 은 이벤트로, 실서버는 폴링이나 SSE 로 구현한다. 어느 쪽이든
   * 클라이언트 코드는 바뀌지 않는다. 헌법 11조에 따라 클라이언트가
   * 확정을 추측하지 않고 서버가 알려준 것만 표시하기 위한 통로다.
   */
  watch(transferId: string, onChange: (transfer: Transfer) => void): Unsubscribe
}

/**
 * 실패는 코드로 분기한다.
 *
 * message 를 그대로 화면에 뿌리지 않는다. 헌법 12조는 화면이
 * "무엇이 실패했는지 / 돈이 어디 있는지 / 지금 뭘 할 수 있는지"를 담으라고 요구하고,
 * 그건 서버 메시지로 대체되지 않는다.
 */
export class ApiError extends Error {
  readonly code: FailureCode
  /**
   * 이체가 성립했는지 클라이언트가 알 수 없는 상태인가.
   *
   * NETWORK·SERVER 가 여기 해당한다. 이 경우 화면은 결과를 추측하지 않고
   * get() 으로 실제 상태를 조회한다. 멱등성 키가 있기 때문에 조회와 재시도가 안전하다.
   */
  readonly outcomeUnknown: boolean

  constructor(code: FailureCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.outcomeUnknown = code === 'NETWORK' || code === 'SERVER'
  }
}

/** 재시도해도 같은 결과가 나오는 실패인가. 헌법 12조의 "지금 뭘 할 수 있는지" 판단에 쓴다. */
export function isRetryable(code: FailureCode): boolean {
  return code === 'NETWORK' || code === 'SERVER'
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export type { Account, Ledger, Transfer, User, UserId, Points }

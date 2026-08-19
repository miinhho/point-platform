import type { FailureCode } from '@/api/contract'
import type { DraftKind } from './draft'

// 실패에서 사용자가 무엇을 할 수 있는가 — docs/JOURNEY.md 여정 6
export interface FailureHandling {
  /** 같은 멱등성 키로 다시 보내도 되는가 */
  retryable: boolean
  /** 금액을 고치면 풀리는가 */
  editable: boolean
  /** 받는 사람을 다시 골라야 하는가 */
  repickable: boolean
  /** 발행자에게만 일어나는 실패인가. 문구를 유통량 기준으로 써야 한다 */
  aboutSupply: boolean
}

export function handleFailure(code: FailureCode, kind: DraftKind): FailureHandling {
  const aboutSupply = kind === 'issue'

  switch (code) {
    case 'INSUFFICIENT_BALANCE':
      return { retryable: false, editable: true, repickable: false, aboutSupply }

    case 'CAP_EXCEEDED':
      // 상한은 다시 시도한다고 달라지지 않는다.
      return { retryable: false, editable: true, repickable: false, aboutSupply }

    case 'NOT_ISSUER':
      // 사용자가 화면에서 풀 수 없다.
      return { retryable: false, editable: false, repickable: false, aboutSupply }

    case 'ISSUER_CANNOT_LEAVE':
      // 은행 화면 안에서 뜬다. 이체 실패 화면으로는 오지 않는다.
      return { retryable: false, editable: false, repickable: false, aboutSupply }

    case 'NOT_MEMBER':
      // 금액을 고쳐도 대상을 바꿔도 풀리지 않는다. 다시 초대받아야 한다.
      return { retryable: false, editable: false, repickable: false, aboutSupply }

    case 'ALREADY_MEMBER':
    case 'INVITE_NOT_FOUND':
      // 초대 화면 안에서 뜬다. 이체 실패 화면으로는 오지 않는다.
      return { retryable: false, editable: false, repickable: false, aboutSupply }

    case 'NOT_A_PRIVATE_BANK':
      // 회원 명부를 물었을 때의 답이다. 이체 실패 화면으로는 오지 않는다.
      return { retryable: false, editable: false, repickable: false, aboutSupply }

    case 'UNKNOWN_ENDPOINT':
      // 사용자가 고칠 것이 없다. 다시 눌러도 같은 경로로 간다.
      return { retryable: false, editable: false, repickable: false, aboutSupply }

    case 'RECIPIENT_NOT_FOUND':
      return { retryable: false, editable: false, repickable: true, aboutSupply }

    case 'POINT_TYPE_NOT_FOUND':
      return { retryable: false, editable: false, repickable: false, aboutSupply }

    case 'NETWORK':
    case 'SERVER':
      return { retryable: true, editable: true, repickable: false, aboutSupply }

    // 이 다섯은 실패 화면에 오지 않는다 — 인증은 로그인으로 가고, 상한 미달은
    // 그 화면 안에서 그 자리에 뜬다. 그래도 값을 주는 것은 화면이 방어적으로
    // 그리기 때문이고, 여기서 빠뜨리면 컴파일이 잡는다.
    case 'CAP_BELOW_ISSUED':
    case 'MALFORMED_REQUEST':
    case 'TRANSFER_NOT_FOUND':
    case 'BAD_CREDENTIALS':
    case 'UNAUTHENTICATED':
      return { retryable: false, editable: false, repickable: false, aboutSupply }
  }
}

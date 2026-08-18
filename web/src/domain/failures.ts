import type { FailureCode, TransferKind } from './types'

// 근거: docs/JOURNEY.md 여정 6. 문구는 shared/i18n/ko.ts 가 갖는다.
export interface FailureHandling {
  /** 서버가 받았는지 알 수 없는가. 화면이 단정하면 안 되는 경우다. */
  outcomeUnknown: boolean
  /** 같은 멱등성 키로 다시 보내도 되는가 */
  retryable: boolean
  /** 금액을 고치면 풀리는가 */
  editable: boolean
  /** 받는 사람을 다시 골라야 하는가 */
  repickable: boolean
  /** 발행자에게만 일어나는 실패인가. 문구를 유통량 기준으로 써야 한다 */
  aboutSupply: boolean
}

export function handleFailure(code: FailureCode, kind: TransferKind): FailureHandling {
  const aboutSupply = kind === 'issue'

  switch (code) {
    case 'INSUFFICIENT_BALANCE':
      return { outcomeUnknown: false, retryable: false, editable: true, repickable: false, aboutSupply }

    case 'CAP_EXCEEDED':
      // 상한은 다시 시도한다고 달라지지 않는다.
      return { outcomeUnknown: false, retryable: false, editable: true, repickable: false, aboutSupply }

    case 'NOT_ISSUER':
      // 사용자가 화면에서 풀 수 없다.
      return { outcomeUnknown: false, retryable: false, editable: false, repickable: false, aboutSupply }

    case 'RECIPIENT_NOT_FOUND':
      return { outcomeUnknown: false, retryable: false, editable: false, repickable: true, aboutSupply }

    case 'POINT_TYPE_NOT_FOUND':
      return { outcomeUnknown: false, retryable: false, editable: false, repickable: false, aboutSupply }

    case 'NETWORK':
    case 'SERVER':
      return { outcomeUnknown: true, retryable: true, editable: true, repickable: false, aboutSupply }
  }
}

/** 문자열 카탈로그 키. 화면이 문구를 조립하지 않게 한다. */
export function failureTitleKey(code: FailureCode): `failure.${FailureCode}.title` {
  return `failure.${code}.title`
}

/** 돈의 위치를 말하는 문구. 이체와 발행이 다르다 */
export function failureWhereKey(
  code: FailureCode,
  kind: TransferKind,
): `failure.${FailureCode}.whereTransfer` | `failure.${FailureCode}.whereIssue` {
  return kind === 'issue' ? `failure.${code}.whereIssue` : `failure.${code}.whereTransfer`
}

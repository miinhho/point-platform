import type { FailureCode, TransferKind } from './types'

/**
 * 실패를 **행동**으로 옮긴다.
 *
 * 여기에 문구는 없다. 이 모듈이 답하는 것은 "사용자가 지금 무엇을 할 수 있는가"이고,
 * 그 답은 문구와 수명이 다르다 — 문체를 고치는 일과 재시도 가능 여부를 고치는 일이
 * 같은 파일에 있으면 둘 중 하나는 반드시 실수로 바뀐다. 문구는 문자열 카탈로그에 있다.
 *
 * 화면이 답해야 하는 세 가지 중 가장 중요한 것은 **돈이 어디 있는가** 다.
 * 사용자가 실패 화면에서 알고 싶은 것은 오류 이름이 아니다.
 */
export interface FailureHandling {
  /**
   * 결과를 알 수 없는 실패인가.
   *
   * 네트워크가 끊기면 서버가 요청을 받았는지 알 수 없다. 이때 "실패했습니다"라고
   * 단정하면 거짓말이 될 수 있다 — 서버는 이미 처리했을지도 모른다.
   */
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
      // 상한은 다시 시도한다고 달라지지 않는다. 재시도를 권하면 사용자는
      // "왜 안 되는지" 대신 "몇 번 더 눌러야 하는지"를 묻게 된다.
      return { outcomeUnknown: false, retryable: false, editable: true, repickable: false, aboutSupply }

    case 'NOT_ISSUER':
      // 권한 문제는 사용자가 화면에서 풀 수 없다. 막다른 화면이 되는 유일한 코드다.
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

/** 문자열 카탈로그의 키. 화면이 문구를 조립하지 않게 한다 */
export function failureTitleKey(code: FailureCode): string {
  return `failure.${code}.title`
}

/** 돈의 위치를 말하는 문구의 키. 이체와 발행이 다르다 */
export function failureWhereKey(code: FailureCode, kind: TransferKind): string {
  return `failure.${code}.where.${kind}`
}

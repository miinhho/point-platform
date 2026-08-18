import type { FailureCode, TransferKind } from './types'

/**
 * 실패를 사람이 행동할 수 있는 형태로 옮긴다 (여정 6).
 *
 * "오류가 발생했습니다. 다시 시도해 주세요"는 세 가지를 다 빼먹는다 —
 * **무엇이 실패했는지**, **돈이 어디 있는지**, **지금 뭘 할 수 있는지.**
 * 그중 가운데가 가장 중요하다. 사용자가 실패 화면에서 실제로 알고 싶은 것은
 * 오류 이름이 아니라 자기 돈의 위치다.
 *
 * 서버 메시지를 그대로 화면에 뿌리지 않는 이유가 이것이다. 서버는 무엇이 실패했는지는
 * 알지만, 사용자가 다음에 무엇을 해야 하는지는 모른다.
 */
export interface FailureExplanation {
  /** 무엇이 실패했는가 */
  title: string
  /** 돈이 어디 있는가 */
  whereIsMoney: string
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
}

export function explainFailure(code: FailureCode, kind: TransferKind): FailureExplanation {
  const isIssue = kind === 'issue'
  const nothingMoved = isIssue
    ? '발행되지 않았다. 총 유통량은 그대로다.'
    : '아무것도 나가지 않았다. 잔액은 그대로다.'

  switch (code) {
    case 'INSUFFICIENT_BALANCE':
      return {
        title: '잔액이 부족하다',
        whereIsMoney: nothingMoved,
        outcomeUnknown: false,
        retryable: false,
        editable: true,
        repickable: false,
      }

    case 'CAP_EXCEEDED':
      return {
        title: '발행 상한을 넘는다',
        whereIsMoney: nothingMoved,
        outcomeUnknown: false,
        // 상한은 다시 시도한다고 달라지지 않는다. 같은 요청을 또 보내게 두면
        // 사용자는 "왜 안 되는지" 대신 "몇 번 더 눌러야 하는지"를 묻게 된다.
        retryable: false,
        editable: true,
        repickable: false,
      }

    case 'RECIPIENT_NOT_FOUND':
      return {
        title: '받는 사람을 찾을 수 없다',
        whereIsMoney: nothingMoved,
        outcomeUnknown: false,
        retryable: false,
        editable: false,
        repickable: true,
      }

    case 'NOT_CANCELLABLE':
      return {
        title: '취소하기에는 늦었다',
        whereIsMoney: '이체는 계속 진행 중이다. 결과는 곧 화면에 나온다.',
        outcomeUnknown: false,
        retryable: false,
        editable: false,
        repickable: false,
      }

    case 'NETWORK':
      return {
        title: '요청이 서버에 닿지 못했다',
        // 여기서 "실패했다"고 단정하지 않는 것이 핵심이다.
        whereIsMoney:
          '서버가 요청을 받았는지 알 수 없다. 다시 시도해도 두 번 처리되지 않는다 — 같은 요청으로 취급된다.',
        outcomeUnknown: true,
        retryable: true,
        editable: true,
        repickable: false,
      }

    case 'SERVER':
      return {
        title: '서버가 요청을 처리하지 못했다',
        whereIsMoney:
          '처리가 어디까지 갔는지 알 수 없다. 다시 시도해도 두 번 처리되지 않는다 — 같은 요청으로 취급된다.',
        outcomeUnknown: true,
        retryable: true,
        editable: true,
        repickable: false,
      }
  }
}

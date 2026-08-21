/**
 * 런타임 목록이 진실이고 타입은 여기서 파생된다. 둘을 따로 두면 코드를 추가할 때
 * 한쪽을 빠뜨리고, 그러면 서버가 보낸 코드가 조용히 `SERVER` 로 떨어진다.
 */
export const FAILURE_CODES = [
  /** 핸들이나 암호가 틀렸다 */
  'BAD_CREDENTIALS',
  /** 토큰이 없거나 만료됐다. 화면은 로그인으로 보낸다 */
  'UNAUTHENTICATED',
  'INSUFFICIENT_BALANCE',
  'CAP_EXCEEDED',
  'NOT_ISSUER',
  /** 은행장은 나가거나 내보내질 수 없다. 발행할 사람이 없는 은행이 된다 */
  'ISSUER_CANNOT_LEAVE',
  /** 비공개 은행의 회원이 아니다. 받는 쪽의 코드와 가려야 할 것이 다르다 */
  'NOT_MEMBER',
  /** 이미 그 은행의 회원이다. 초대 화면이 후보에서 빼므로 겹쳐 들어온 경우에만 난다 */
  'ALREADY_MEMBER',
  /** 내 앞으로 온 초대가 없다. 남의 초대와 같은 답이다 */
  'INVITE_NOT_FOUND',
  /** 공개 은행이라 회원 명부가 없다. 비어 있는 것이 아니라 개념이 없는 것이다 */
  'NOT_A_PRIVATE_BANK',
  /** 이 서버에 없는 경로. 고칠 입력이 없으므로 형식 오류가 아니다 */
  'UNKNOWN_ENDPOINT',
  'RECIPIENT_NOT_FOUND',
  'POINT_TYPE_NOT_FOUND',
  /** 이미 발행한 양보다 낮은 상한 */
  'CAP_BELOW_ISSUED',
  /** 본문이 계약과 다르다. 화면에서는 도달하지 않는다 */
  'MALFORMED_REQUEST',
  /** 그 이체가 없거나 내 것이 아니다 */
  'TRANSFER_NOT_FOUND',
  /** 그 발행이 없거나 내 것이 아니다. 발행은 이체가 아니라 코드를 빌려 쓰지 않는다 */
  'ISSUE_NOT_FOUND',
  /** 결과를 알 수 없다. 이 둘만 그렇다 */
  'NETWORK',
  'SERVER',
] as const

export type FailureCode = (typeof FAILURE_CODES)[number]

/**
 * 서버가 처리했는지 아는가. **코드에서 파생하지 않는다** — 코드를 늘릴 때마다
 * 클라이언트가 표를 함께 늘려야 하고, 빠뜨리면 확정된 실패를 「어디까지 갔는지
 * 알 수 없어요」라고 말하게 된다. 계약: docs/API.md
 */
export type FailureOutcome = 'none' | 'unknown'

export interface Failure {
  code: FailureCode
  outcome: FailureOutcome
  message: string
}

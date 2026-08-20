import type { FailureCode } from '@/shared/contract'
import type { DraftKind } from '@/features/transfer'

// 화면이 문구를 조립하지 않게 키를 여기서 만든다. 문구 자체는 ko.ts 가 갖는다.

export function failureTitleKey(code: FailureCode): `failure.${FailureCode}.title` {
  return `failure.${code}.title`
}

/** 돈의 위치를 말하는 문구. 이체와 발행이 다르다 */
export function failureWhereKey(
  code: FailureCode,
  kind: DraftKind,
): `failure.${FailureCode}.whereTransfer` | `failure.${FailureCode}.whereIssue` {
  return kind === 'issue' ? `failure.${code}.whereIssue` : `failure.${code}.whereTransfer`
}

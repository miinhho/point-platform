import type { Points, PointType } from '@/shared/contract'

/**
 * 앞으로 더 발행할 수 있는 양. **서버가 실어 주지 않는다** — 상한에서 유통량을 빼면
 * 나오는 값이라 규칙이 아니라 뺄셈이고, 규칙 판정(`canIssue`)만 서버가 한다.
 * 계약: docs/API.md 「발행자만 갖는 것은 값이 아니라 바꾸는 힘이다」
 *
 * 넘기는 것을 막는 것은 이 값이 아니라 서버다(`CAP_EXCEEDED`). 화면은 입력 중에
 * 미리 말할 뿐이다.
 */
export function headroomOf(pointType: Pick<PointType, 'issueCap' | 'totalIssued'>): Points {
  return pointType.issueCap - pointType.totalIssued
}

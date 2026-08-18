/**
 * 은행이 언제 생겼는가. 내역과 달리 연도를 쓴다 — 어제 만든 것과 1년 된 것을
 * 가르는 것이 이 표기의 목적이다. 근거: docs/JOURNEY.md 여정 10
 */
export function formatCreated(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR')
}

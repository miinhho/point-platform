/**
 * 금액 글자 크기를 자릿수에 맞춰 줄인다.
 *
 * 큰 숫자를 고정 크기로 두면 화면 오른쪽에서 잘린다. 잘린 금액은 **읽을 수 없는
 * 금액**이고, 자릿수 오타를 막으려고 만든 화면이 자릿수를 감추는 화면이 된다.
 * 줄바꿈은 답이 아니다 — 금액이 두 줄로 나뉘면 자릿수를 세는 일이 더 어려워진다.
 *
 * 실제 폭을 재지 않고 자릿수로 정한다. 측정은 렌더 후에야 가능해서 한 프레임 동안
 * 잘린 상태가 보이고, 그 한 프레임이 하필 사용자가 금액을 확인하는 순간이다.
 *
 * 경계값은 CSS 뷰포트 360px(Galaxy S22)에서 잘리지 않는 지점으로 잡았다.
 */
const FULL = 'clamp(2.125rem, 11vw, 2.875rem)'
const MID = 'clamp(1.75rem, 8.5vw, 2.25rem)'
const SMALL = 'clamp(1.375rem, 6.5vw, 1.75rem)'

/** @param grouped 쉼표가 들어간 표기 ("1,234,567") */
export function amountFontSize(grouped: string): string {
  if (grouped.length >= 15) return SMALL
  if (grouped.length >= 12) return MID
  return FULL
}

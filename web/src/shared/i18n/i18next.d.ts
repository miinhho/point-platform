import type { ko } from './ko'

/**
 * 키에 타입을 붙인다.
 *
 * 이것이 없으면 `t('confirm.holdTransfr')` 같은 오타가 런타임에 키 문자열로 보인다.
 * 문자열을 카탈로그로 옮긴 이유 절반이 여기 있다 — 옮기기만 하고 타입이 없으면
 * 하드코딩보다 나쁘다. 하드코딩은 최소한 오타가 화면에 그대로 보인다.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof ko }
  }
}

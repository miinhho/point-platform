import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ko } from './ko'

/**
 * i18next.
 *
 * locale 은 `ko` 하나다. 다국어가 목적이 아니라 **하드코딩을 막는 것**이 목적이다.
 * 문자열이 한 곳에 모여 있어야 문체를 한 번에 고칠 수 있고, 문구 규칙을 테스트로
 * 잡을 수 있다.
 *
 * RN 셸에서도 같은 카탈로그를 쓸 수 있다는 점이 자체 구현 대신 이것을 고른 이유다.
 */
export const i18n = i18next.createInstance()

void i18n.use(initReactI18next).init({
  lng: 'ko',
  fallbackLng: 'ko',
  resources: { ko: { translation: ko } },
  interpolation: {
    // React 가 이미 escape 한다. 여기서 한 번 더 하면 따옴표가 &quot; 로 보인다.
    escapeValue: false,
  },
  // 키가 없으면 조용히 키 문자열을 보여주는 대신 개발 중에 눈에 띄게 한다.
  parseMissingKeyHandler: (key) => (import.meta.env.DEV ? `⟨${key}⟩` : key),
})

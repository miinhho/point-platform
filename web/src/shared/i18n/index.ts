import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ko } from './ko'

// 다국어가 아니라 하드코딩 방지가 목적이다.
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

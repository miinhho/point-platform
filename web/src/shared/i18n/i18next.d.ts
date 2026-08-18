import type { ko } from './ko'

// 키 오타를 컴파일 시점에 잡는다.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof ko }
  }
}

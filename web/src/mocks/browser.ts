import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** 서비스 워커는 보안 컨텍스트만 허용한다. 실기기는 `adb reverse` 로 localhost. */
export const worker = setupWorker(...handlers)

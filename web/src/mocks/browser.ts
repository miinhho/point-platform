import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * 브라우저용 워커.
 *
 * 서비스 워커는 보안 컨텍스트에서만 등록된다. 실기기에서 볼 때 LAN IP(`http://172...`)
 * 로 열면 등록되지 않으므로 `adb reverse tcp:5173 tcp:5173` 후 `localhost` 로 열어야 한다.
 * `localhost` 는 보안 컨텍스트로 취급된다.
 */
export const worker = setupWorker(...handlers)

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** 테스트용. 앱과 같은 핸들러를 쓰므로 테스트가 검증하는 것이 실제 계약이다. */
export const server = setupServer(...handlers)

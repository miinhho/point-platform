import { QueryClient } from '@tanstack/react-query'

/**
 * 서버 상태 캐시 설정.
 *
 * `refetchOnWindowFocus` 를 켜 두는 것이 이 앱에서는 기능이다. WebView 셸에서
 * 앱으로 돌아오면 포커스 이벤트가 오고, 그때 잔액을 다시 읽는다 — 다른 기기에서
 * 보냈거나 누가 나에게 보냈을 수 있다. 1차 구현은 이것을 `reloadToken` 이라는
 * 손으로 만든 숫자로 흉내냈고, 주석과 동작이 어긋났다.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 잔액은 금방 낡는다. 화면에 들어올 때마다 다시 읽되, 연달아 들어오는
        // 요청은 합친다.
        staleTime: 5_000,
        // 결과를 알 수 없는 실패에서 조용히 다시 시도하지 않는다. 조회는 안전하지만,
        // 한 번 실패한 조회를 세 번 재시도하면 사용자는 화면이 멈춘 것으로 본다.
        retry: 1,
        retryDelay: 400,
      },
      mutations: {
        // 쓰기는 절대 자동 재시도하지 않는다. 멱등성 키가 있어 안전하긴 하지만,
        // 재시도는 사용자가 화면을 보고 내리는 결정이어야 한다.
        retry: false,
      },
    },
  })
}

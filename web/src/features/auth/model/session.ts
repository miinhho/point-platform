import { useQueryClient } from '@tanstack/react-query'
import { setToken } from '@/api/http'
import { queryKeys } from '@/api/queries'
import type { Session } from '@/api/endpoints'

/** 토큰은 `api/http.ts` 가 메모리에 들고, 사용자는 서버에 묻는다. 두 곳에 두지 않는다. */
export function useSession() {
  const client = useQueryClient()

  return {
    signIn: (session: Session) => {
      setToken(session.token)
      void client.invalidateQueries()
    },
    /**
     * 명시적으로 나갈 때만 캐시를 지운다.
     *
     * 401 을 받았을 때 지우면 진행 중인 세션 조회가 다시 나가고 또 401 을 받아
     * 요청이 끝없이 돈다. 그때는 토큰만 버리면 세션 조회가 실패한 채로 남고
     * 화면이 로그인으로 간다.
     */
    /**
     * 나가는 것은 즉시 확정된다. 요청을 기다리는 동안 남의 잔액이 보이면 안 된다.
     *
     * 캐시를 비우지 않는 이유는 그러면 세션 조회가 다시 나가 화면이 비기 때문이다.
     * 남은 캐시는 화면에 닿지 않는다 — 셸이 세션 없이는 아무것도 그리지 않는다.
     */
    signOut: () => {
      setToken(null)
      client.setQueryData(queryKeys.me, null)
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
    },
  }
}

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { authApi, invitesApi, newIdempotencyKey, setTokens } from '@/shared/api'
import { isMember } from '@/mocks/ledger'
import { setSim } from '@/mocks/sim'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/**
 * **서버는 했는데 클라이언트가 못 받았다.** 계약이 「이미 회원인데 수락하면 성공이다」와
 * 「이미 나간 사람이 다시 나가도 `204`」를 정당화한 전제가 이것이다 — 계약: docs/API.md.
 *
 * 서버가 같은 답을 주는지는 서버가 시험한다. 여기서 묻는 것은 **화면이 그 답을 받고
 * 무엇을 하는가**다.
 *
 * 유실이 실제로 일어난 것을 먼저 확인한다 — **서버는 했고 화면은 모른다**, 둘 다.
 * 안 그러면 응답이 멀쩡히 왔는데 **한 번 더 눌러서 통과하는** 테스트가 되고, 그것은
 * 유실에 대해 아무것도 증명하지 않는다.
 */
async function open(path: string, handle: string) {
  await signInAs(handle)
  history.replaceState(null, '', path)
  renderApp(<App />)
  return userEvent.setup()
}

async function settle() {
  await waitFor(() => expect(screen.getAllByRole('banner')).toHaveLength(1))
}

/**
 * 유실될 요청에만 지연을 준다. 테스트는 지연 0 으로 도는데(`test/setup.ts`), 그러면
 * **도는 중이 관측되지 않아** 실패로 끝난 것과 성공한 것을 가릴 수 없다.
 */
const LOSS_MS = 200

/**
 * 그 버튼의 요청이 **실패로** 끝날 때까지. 도는 동안은 잠겨 있고, 성공이면 화면이
 * 바뀌어 버튼이 사라지므로, 다시 눌리는 채로 남는 것은 실패뿐이다.
 */
async function settled(name: string) {
  const button = () => screen.getByRole('button', { name })
  await waitFor(() => expect(button()).toHaveProperty('disabled', true))
  setSim({ latencyMs: 0 })
  await waitFor(() => expect(button()).toHaveProperty('disabled', false))
}

beforeEach(async () => {
  await signInAs()
})

describe('응답이 유실된 뒤 다시 누르는 사람', () => {
  it('수락을 다시 눌러도 실패로 끝나지 않고 들어간 화면이 된다', async () => {
    await invitesApi.createInvite('pt_cl', 'u_jisu', newIdempotencyKey())

    const user = await open('/points/pt_cl', '@jisu')
    await screen.findByRole('heading', { name: '동아리회비' })
    await settle()

    setSim({ latencyMs: LOSS_MS, loseNextResponse: true })
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await settled('들어가기')
    // 서버는 회원으로 만들었는데
    expect(isMember('pt_cl', 'u_jisu')).toBe(true)
    /*
     * 화면은 그것을 모른다. **이 둘이 같이 참인 것이 유실이다** — 원장만 보면 응답이
     * 멀쩡히 온 경우도 통과한다. 성공을 알리는 말과 이 버튼은 같은 곳에 살아서 같이
     * 사라지므로, 버튼이 있는데 그 말이 없으면 그것은 실패로 끝났다는 뜻이다.
     */
    expect(screen.queryByText('들어왔어요')).toBeNull()

    // 다시 누른다. 이 사람이 아는 것은 「안 됐다」뿐이다
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    // 「이미 회원이에요」가 아니라 들어간 화면이다
    await waitFor(() => expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull())
    expect(screen.queryByText('이미 그 은행의 회원이에요')).toBeNull()
  })

  it('나가기를 다시 눌러도 홈으로 간다', async () => {
    setTokens(await authApi.login({ handle: '@jisoo', password: 'point' }))

    const user = await open('/points/pt_cl/members', '@jisoo')
    await screen.findByRole('button', { name: '나가기' })
    await settle()

    setSim({ latencyMs: LOSS_MS, loseNextResponse: true })
    await user.click(screen.getByRole('button', { name: '나가기' }))

    await settled('나가기')
    // 서버는 내보냈고 화면은 아직 명부에 있다
    expect(isMember('pt_cl', 'u_jisoo')).toBe(false)
    expect(location.pathname).toBe('/points/pt_cl/members')

    await user.click(screen.getByRole('button', { name: '나가기' }))

    await waitFor(() => expect(location.pathname).toBe('/'))
  })
})

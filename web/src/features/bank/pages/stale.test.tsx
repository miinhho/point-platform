// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { authApi, invitesApi, newIdempotencyKey, setTokens } from '@/shared/api'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/*
 * **낡은 성공이 고정되는 것**이 실패를 빈 화면으로 두는 것보다 나쁘다. 앞엣것은
 * 사용자가 이상하다고 느끼기라도 하는데, 이것은 화면이 옛말을 **확신에 차서** 한다 —
 * 되돌릴 수 없는 앱에서 「당신은 회원입니다」라고. 관측: docs/FIELD.md W16
 */
describe('나간 뒤 돌아가면', () => {
  it('회원이었던 화면을 그대로 보여주지 않는다', async () => {
    setTokens(await authApi.login({ handle: '@minho', password: 'point' }))
    await invitesApi.createInvite('pt_cl', 'u_jisu', newIdempotencyKey())
    setTokens(await authApi.login({ handle: '@jisu', password: 'point' }))
    await invitesApi.acceptInvite('pt_cl')

    const user = userEvent.setup()
    await signInAs('@jisu')
    history.replaceState(null, '', '/')
    renderApp(<App />)

    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl'))
    await user.click(await screen.findByRole('button', { name: '회원 보기' }))
    await user.click(await screen.findByRole('button', { name: '나가기' }))
    await waitFor(() => expect(location.pathname).toBe('/'))

    // 뒤로 가면 그 은행은 이제 나에게 없다 (GET 이 404 다)
    history.back()
    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl'))
    await new Promise((r) => setTimeout(r, 300))

    expect(screen.queryByRole('button', { name: '회원 보기' })).toBeNull()
  })

  /*
   * **`404` 는 답이다.** 다시 해도 같으므로 다시 하는 길을 주지 않는다 — 답인 것에
   * 「다시 시도」를 주면 영원히 같은 답을 받는다. 규칙: CLAUDE.md
   *
   * 홈으로 대체하지 않는 이유는 사용자가 **돌아가려고** back 을 눌렀기 때문이다.
   * 대체하면 그 한 번이 통째로 사라져 「back 이 안 먹는다」로 읽힌다.
   */
  it('없다는 답에는 다시 시도를 주지 않는다', async () => {
    setTokens(await authApi.login({ handle: '@minho', password: 'point' }))
    await invitesApi.createInvite('pt_cl', 'u_jisu', newIdempotencyKey())
    setTokens(await authApi.login({ handle: '@jisu', password: 'point' }))
    await invitesApi.acceptInvite('pt_cl')

    const user = userEvent.setup()
    await signInAs('@jisu')
    history.replaceState(null, '', '/')
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    await user.click(await screen.findByRole('button', { name: '회원 보기' }))
    await user.click(await screen.findByRole('button', { name: '나가기' }))
    await waitFor(() => expect(location.pathname).toBe('/'))

    history.back()
    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl'))

    expect(await screen.findByText('이 은행은 볼 수 없어요')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    // back 은 삼켜지지 않는다. 은행 페이지 자리에 그대로 선다
    expect(location.pathname).toBe('/points/pt_cl')
  })

  /*
   * **모르겠다는 답이 아니다.** 서버가 넘어진 것에 「볼 수 없어요」라고 하면 다시
   * 해 보면 될 것을 없다고 말하는 것이다.
   */
  it('못 불러온 것에는 다시 시도를 준다', async () => {
    server.use(
      http.get('*/api/point-types/:id', () =>
        HttpResponse.json({ code: 'SERVER', outcome: 'none', message: '' }, { status: 500 }),
      ),
    )
    await signInAs('@jisoo')
    history.replaceState(null, '', '/points/pt_cl')
    renderApp(<App />)

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(screen.queryByText('이 은행은 볼 수 없어요')).toBeNull()
  })
})

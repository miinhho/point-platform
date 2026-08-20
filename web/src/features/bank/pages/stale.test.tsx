// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
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
})

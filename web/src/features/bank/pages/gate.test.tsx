// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { authApi, invitesApi, newIdempotencyKey, pointsApi, setTokens } from '@/shared/api'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/**
 * 권한이 걸린 주소 — 계약: docs/REBUILD.md 「주소가 나에게 열려 있는가는 이미 실려 온다」
 *
 * 주소를 준 것이 문을 하나 열었다. 버튼은 `canIssue` · `membership` 으로 갈렸는데
 * 주소는 안 갈렸다.
 */
async function open(path: string, handle: string) {
  await signInAs(handle)
  history.replaceState(null, '', path)
  renderApp(<App />)
}

/** 대체는 히스토리에 쌓이지 않는다 */
const depth = () => history.length

/** 전환 중에는 두 화면이 함께 떠 있다 */
async function settle() {
  await waitFor(() => expect(screen.getAllByRole('banner')).toHaveLength(1))
}

describe('막힌 주소는 은행 페이지로 대체한다', () => {
  it('은행장이 아니면 초대 화면이 열리지 않는다', async () => {
    // `@jisoo` 는 `pt_cl` 의 회원이지만 은행장이 아니다
    await open('/points/pt_cl/invite', '@jisoo')

    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl'))
    await settle()
    expect(screen.queryByText('누구를 초대할까요?')).toBeNull()
  })

  /*
   * **한 번 받은 사람은 영원히 닿는다**(계약: docs/API.md). 그래서 **닿기는 하는데
   * 회원은 아닌** 사람이 생기고, 명부는 그 사람에게 열리지 않아야 한다.
   */
  it('나온 사람에게 명부가 열리지 않는다', async () => {
    setTokens(await (await import('@/shared/api')).authApi.login({ handle: '@taeyun', password: 'point' }))
    await pointsApi.leaveBank('pt_hd')

    await open('/points/pt_hd/members', '@taeyun')

    await waitFor(() => expect(location.pathname).toBe('/points/pt_hd'))
    await settle()
    // 받은 적이 있으므로 은행 페이지 자체는 보인다 — 잔액을 다 써도 그렇다
    expect(await screen.findByText('이 은행의 회원이 아니에요')).toBeTruthy()
  })

  it('은행장에게는 초대 화면이 그대로 열린다', async () => {
    await open('/points/pt_cl/invite', '@minho')

    expect(await screen.findByText('누구를 초대할까요?')).toBeTruthy()
    expect(location.pathname).toBe('/points/pt_cl/invite')
  })

  /*
   * 쌓으면 뒤로 가기가 막힌 주소로 다시 가고 같은 자리를 돈다.
   * 계약: 「히스토리에 남기지 않는다」
   */
  it('대체는 히스토리에 쌓이지 않는다', async () => {
    await open('/points/pt_cl/invite', '@jisoo')
    const before = depth()
    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl'))

    expect(depth()).toBe(before)
  })
})

/*
 * 「막혔다」와 「못 불러왔다」는 다른 사건이다. 앞엣것은 애초에 열리지 않았어야 할
 * 문이고, 뒤엣것은 다시 해 보면 열릴 수 있다. 규칙: CLAUDE.md
 */
describe('못 불러온 것은 빈 화면이 아니다', () => {
  it('은행을 못 불러와도 명부 화면에 돌아갈 길과 다시 할 길이 있다', async () => {
    server.use(
      http.get('*/api/point-types/:id', () =>
        HttpResponse.json({ code: 'SERVER', outcome: 'none', message: '' }, { status: 500 }),
      ),
    )
    await open('/points/pt_cl/members', '@minho')

    // 헤더가 남는다 — 통째로 비우면 돌아갈 길이 사라진다
    expect(await screen.findByRole('banner')).toBeTruthy()
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
    // 실패는 막힘이 아니다. 대체하지 않는다
    expect(location.pathname).toBe('/points/pt_cl/members')
  })
})

/*
 * 「나갔다」와 「원래 못 들어온다」는 다른 사건이라 다른 이동이어야 한다.
 * 앞엣것은 사용자가 방금 한 일의 결과라 **그 결과를 보여준다.** 뒤엣것은 애초에
 * 열리지 않았어야 할 문이라 **아무 일도 없었던 것처럼 대체한다.**
 *
 * 목적지도 다르다 — 나가기는 홈, 가드는 은행 페이지. 그래서 두 기제가 같은 화면을
 * 다투지 않는다.
 */
describe('나가면 홈으로 간다', () => {
  it('잔액이 남아 있어도 홈이다', async () => {
    const user = userEvent.setup()
    await open('/points/pt_cl/members', '@jisoo')
    await user.click(await screen.findByRole('button', { name: '나가기' }))

    await waitFor(() => expect(location.pathname).toBe('/'))
    await settle()
    expect(await screen.findByText('내 포인트')).toBeTruthy()
  })

  /*
   * **관계가 하나도 안 남으면 그 은행은 그 사람에게 없어진다.** `@jisu` 가 그 경우다 —
   * 수락이 초대를 소진했고, 받은 적이 없고, 나가서 회원도 아니다. `reachable` 이 보는
   * 넷(공개·회원·초대·받은 적)이 전부 거짓이다. **잔액이 아니다** — 다 쓰고 나간 사람은
   * 잔액이 0 이어도 계속 닿는다(`7ab776b` 「한 번 받은 사람은 영원히 닿는다」).
   *
   * 은행 페이지로 보내면 「못 불러왔어요 · 다시 시도」에 갇히고, 다시 시도는 영원히
   * 404 다 — 자기가 방금 한 일의 결과인데 우리가 실패했다고 말하는 것이다.
   */
  it('관계가 안 남아 은행이 사라져도 실패 화면에 갇히지 않는다', async () => {
    setTokens(await authApi.login({ handle: '@minho', password: 'point' }))
    await invitesApi.createInvite('pt_cl', 'u_jisu', newIdempotencyKey())
    setTokens(await authApi.login({ handle: '@jisu', password: 'point' }))
    await invitesApi.acceptInvite('pt_cl')

    const user = userEvent.setup()
    await open('/points/pt_cl/members', '@jisu')
    await user.click(await screen.findByRole('button', { name: '나가기' }))

    await waitFor(() => expect(location.pathname).toBe('/'))
    await settle()
    expect(screen.queryByText('불러오지 못했어요')).toBeNull()
    expect(await screen.findByText('내 포인트')).toBeTruthy()
  })

  it('나간 뒤 뒤로 가도 명부로 돌아가지 않는다', async () => {
    const user = userEvent.setup()
    await signInAs('@jisoo')
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    await user.click(await screen.findByRole('button', { name: '회원 보기' }))
    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl/members'))

    await user.click(await screen.findByRole('button', { name: '나가기' }))
    await waitFor(() => expect(location.pathname).toBe('/'))

    // 명부가 아니라 그 전에 있던 은행 페이지로 간다
    history.back()
    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl'))
  })
})

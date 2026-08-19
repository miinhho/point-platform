// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { endpoints } from '@/api/endpoints'
import { newIdempotencyKey } from '@/api/http'
import { server } from '@/mocks/node'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/*
 * 조회가 실패했을 때 어느 화면도 「비어 있음」으로 보이지 않는다.
 *
 * 이 앱은 「가진 적 없는 0」과 「가졌던 0」을 가르려고 애쓴다(여정 1). 「못 불러온
 * 것」이 그 둘과 같아 보이면 그 노력이 통째로 무너진다. 규칙: CLAUDE.md
 */
beforeEach(async () => {
  await signInAs()
})

/** 그 경로만 500 을 준다. 나머지는 Mock 이 그대로 답한다 */
function breaks(path: string) {
  server.use(
    http.get(path, () => HttpResponse.json({ code: 'SERVER', outcome: 'none' }, { status: 500 })),
  )
}

/** 실패 자리는 셋을 말한다 — 무엇이 실패했는지 · 돈이 어디 있는지 · 지금 뭘 할 수 있는지 */
async function expectFailureSlot(label: RegExp) {
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(label)
  expect(alert.textContent).toContain('아무것도 바뀌지 않았어요')
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
}

describe('조회가 실패하면 그렇게 말한다', () => {
  it('홈 — 지갑', async () => {
    breaks('*/api/wallet')
    renderApp(<App />)

    await expectFailureSlot(/지갑을 불러오지 못했어요/)
    expect(screen.queryByText('아직 받은 포인트가 없어요')).toBeNull()
  })

  it('내역', async () => {
    breaks('*/api/history')
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '내역' }))

    await expectFailureSlot(/내역을 불러오지 못했어요/)
    expect(screen.queryByText('아직 보낸 것이 없어요')).toBeNull()
  })

  it('받는 사람 고르기', async () => {
    breaks('*/api/users')
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /금머니.*620,000/ }))

    await expectFailureSlot(/받는 사람을 불러오지 못했어요/)
    expect(screen.queryByText('보낼 수 있는 사람이 없어요')).toBeNull()
  })

  it('은행 페이지', async () => {
    breaks('*/api/point-types/:id')
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '금머니 자세히' }))

    await expectFailureSlot(/이 은행을 불러오지 못했어요/)
    // 헤더는 남는다 — 돌아갈 길이 보여야 한다.
    expect(screen.getByRole('button', { name: '뒤로' })).toBeTruthy()
  })

  it('회원 명부', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    breaks('*/api/point-types/:id/members')
    await user.click(await screen.findByRole('button', { name: '회원 보기' }))

    await expectFailureSlot(/회원을 불러오지 못했어요/)
  })

  it('내역 상세', async () => {
    // 상세로 갈 수 있는 것은 이체뿐이다. 화면을 거치지 않고 원장에 하나 만든다.
    await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 1_000 },
      newIdempotencyKey(),
    )

    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '내역' }))

    breaks('*/api/transfers/:id')
    await user.click(await screen.findByRole('button', { name: /김지수/ }))

    await expectFailureSlot(/이 내역을 불러오지 못했어요/)
  })
})

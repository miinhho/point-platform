// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 여정 10 */

beforeEach(async () => {
  await signInAs()
})

/** 홈 → 동아리회비(내가 은행장인 비공개 은행) → 초대하기 */
async function openInvite() {
  const user = userEvent.setup()
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
  await user.click(await screen.findByRole('button', { name: '초대하기' }))
  await screen.findByText('누구를 초대할까요?')
  return user
}

describe('초대한다', () => {
  /*
   * 초대할 수 없는 사람을 눌러 볼 수 있게 두면 정상 경로에서 `ALREADY_MEMBER` 를
   * 만나게 된다 — 그건 겹쳐 들어온 경우에만 나오는 막다른 답이다. 계약: docs/API.md
   */
  it('이미 회원인 사람은 후보에 없다', async () => {
    await openInvite()
    // 회원이 아닌 사람이 먼저 뜨는 것을 보고 나서 센다.
    await screen.findByRole('button', { name: /@taeyun/ })

    // `@jisoo` 는 이미 `pt_cl` 의 회원이다.
    await waitFor(() => expect(screen.queryByText('@jisoo')).toBeNull())
  })

  it('초대하면 그 줄이 초대했다고 말한다', async () => {
    const user = await openInvite()
    const taeyun = await screen.findByRole('button', { name: /@taeyun/ })
    await user.click(taeyun)

    expect(await screen.findByText('초대했어요')).toBeTruthy()
  })
})

describe('초대받은 사람이 들어온다', () => {
  async function invited() {
    const user = await openInvite()
    await user.click(await screen.findByRole('button', { name: /@jisu/ }))
    await screen.findByText('초대했어요')

    /*
     * 사람을 바꾸는 것은 실제로는 새 세션이다 — 토큰이 메모리에만 있어서 새로고침을
     * 지난다. 주소를 두고 오면 앞사람이 보던 화면에서 시작하게 된다.
     */
    history.replaceState(null, '', '/')
    await signInAs('@jisu')
    renderApp(<App />)
    return user
  }

  // 초대를 열면 은행 페이지가 열린다. 판단할 것은 거기 다 있다.
  it('홈에서 초대를 열면 은행 페이지가 열린다', async () => {
    const user = await invited()

    expect(await screen.findByText('받은 초대')).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: /동아리회비/ }))

    await screen.findByRole('heading', { name: '동아리회비' })
    // 판단의 근거가 거기 있다.
    expect(screen.getAllByText('@minho').length).toBeGreaterThan(0)
  })

  /*
   * 가입은 되돌릴 수 있다 — 나가면 된다. 되돌릴 수 없는 것은 그 안에서 주고받은
   * 것이지 소속이 아니다. 무게를 아무 데나 두면 무게가 뜻을 잃는다.
   */
  it('들어가기에 꾹 누르기가 없다', async () => {
    const user = await invited()
    await user.click(await screen.findByRole('button', { name: /동아리회비/ }))

    expect(await screen.findByRole('button', { name: '들어가기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /꾹 눌러서/ })).toBeNull()
  })

  it('거절 버튼이 없다', async () => {
    const user = await invited()
    await screen.findByText('받은 초대')

    expect(document.body.textContent).not.toMatch(/거절|무시하기/)
    await user.click(await screen.findByRole('button', { name: /동아리회비/ }))
    await screen.findByRole('heading', { name: '동아리회비' })
    expect(document.body.textContent).not.toMatch(/거절|무시하기/)
  })

  /*
   * 수락은 은행을 가리킨다 — 계약: docs/API.md. 그래서 은행 페이지가 초대 목록을
   * 읽을 이유가 없다.
   *
   * 읽으면 화면이 초대 **id** 를 쥐게 되고, 초대는 소진되면 새 행이 나므로 그 값은
   * 낡는다. 내보내졌다가 다시 초대받은 사람에게 「초대받았어요」라고 떠 있는데
   * 눌러도 404 인 자리가 거기서 난다.
   */
  it('은행 페이지가 초대 목록을 읽지 않는다', async () => {
    await openInvite().then((user) => user.click(screen.getByRole('button', { name: /@jisu/ })))
    await screen.findByText('초대했어요')
    await signInAs('@jisu')

    /*
     * **주소로 바로 들어간다.** 초대함을 지나면 그 화면이 이미 `['invites']` 를
     * 채워 두므로, 은행 페이지가 그것을 읽어도 캐시가 답해 요청이 안 나간다 —
     * 그러면 이 단언은 코드가 아니라 캐시 상태를 재게 된다.
     */
    const asked: string[] = []
    server.events.on('request:start', ({ request }) => asked.push(new URL(request.url).pathname))

    history.replaceState(null, '', '/points/pt_cl')
    renderApp(<App />)
    await screen.findByRole('button', { name: '들어가기' })

    expect(asked).toContain('/api/point-types/pt_cl')
    expect(asked).not.toContain('/api/invites')
  })

  it('들어가면 초대가 사라지고 회원이 된다', async () => {
    const user = await invited()
    await user.click(await screen.findByRole('button', { name: /동아리회비/ }))
    await user.click(await screen.findByRole('button', { name: '들어가기' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull(),
    )
  })
})

/*
 * 거르지 못한 목록을 「초대할 수 있는 사람들」로 보여주면, 거기서 고른 사람이
 * `ALREADY_MEMBER` 라는 막다른 답을 만난다 — 후보에서 회원을 빼는 것이 바로 그것을
 * 막으려던 것이다. 규칙: CLAUDE.md 「없는 것과 못 불러온 것을 같게 보이지 않는다」
 */
describe('거르지 못한 후보를 보여주지 않는다', () => {
  it('회원 조회가 실패하면 후보 대신 실패를 말한다', async () => {
    server.use(
      http.get('*/api/users', ({ request }) => {
        // 거르는 쪽만 넘어뜨린다. 전역 검색은 그대로 돈다
        if (!new URL(request.url).searchParams.get('pointTypeId')) return
        return HttpResponse.json({ code: 'SERVER', outcome: 'none', message: '' }, { status: 500 })
      }),
    )
    history.replaceState(null, '', '/points/pt_cl/invite')
    renderApp(<App />)

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
    // `@jisoo` 는 이미 `pt_cl` 의 회원이다. 거르지 못한 채로 뜨면 안 된다
    expect(screen.queryByText('@jisoo')).toBeNull()
  })
})

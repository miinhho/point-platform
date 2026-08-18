// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
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
  it('이미 회원인 사람은 초대할 수 없다고 말한다', async () => {
    await openInvite()
    // `@jisoo` 는 이미 `pt_cl` 의 회원이다. 사라지지 않고 그렇게 표시된다.
    const jisoo = await screen.findByText('@jisoo')
    await waitFor(() => expect(screen.getByText('이미 회원이에요')).toBeTruthy())
    expect(jisoo.closest('button')).toBeNull()
    // 회원이 아닌 사람은 누를 수 있다.
    expect(screen.getByRole('button', { name: /@taeyun/ })).toBeTruthy()
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

  it('들어가면 초대가 사라지고 회원이 된다', async () => {
    const user = await invited()
    await user.click(await screen.findByRole('button', { name: /동아리회비/ }))
    await user.click(await screen.findByRole('button', { name: '들어가기' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull(),
    )
  })
})

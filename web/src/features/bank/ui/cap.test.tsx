// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 여정 9 · 여정 8 */

beforeEach(async () => {
  await signInAs()
})

async function hold(ms: number) {
  const button = screen.getByRole('button', { name: '꾹 눌러서 바꾸기' })
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, ms))
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
}

/** 홈 → 금머니 카드의 진입점 → 은행 페이지 → 상한 바꾸기 */
async function openChangeCap(user: ReturnType<typeof userEvent.setup>) {
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: '금머니 자세히' }))
  await user.click(await screen.findByRole('button', { name: '상한 바꾸기' }))
  await screen.findByLabelText('새 상한')
}

/** 은행 페이지로 돌아왔는가. 제목이 포인트 이름이다 */
const atBank = () => screen.findByRole('heading', { name: '금머니' }, { timeout: 5000 })

describe('상한을 바꾼다', () => {
  it('꾹 눌러서 바꾸면 은행 페이지의 상한이 바뀐다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(750)

    // 은행 페이지로 돌아오고 그 화면의 상한이 새 값이다.
    expect(await atBank()).toBeTruthy()
    await waitFor(() => expect(screen.getByText('20,000,000')).toBeTruthy())
  })

  // 만들기·발행과 같은 손동작이다. 다른 손동작을 요구하면 어느 것이 무거운지 알 수 없다.
  it('짧게 누르면 바뀌지 않는다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(200)
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.getByLabelText('새 상한')).toBeTruthy()
  })

  it('지금과 같은 값으로는 확정할 수 없다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '10000000')
    expect(screen.getByRole('button', { name: '꾹 눌러서 바꾸기' })).toHaveProperty('disabled', true)
  })

  it('이미 발행한 양보다 낮추면 그 자리에서 말한다 — 실패 화면으로 보내지 않는다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '1000000')
    await hold(750)

    expect(await screen.findByText('이미 발행한 양보다 낮아요', {}, { timeout: 5000 })).toBeTruthy()
    // 입력을 잃지 않고, 고칠 자리에 포커스가 있다.
    expect(screen.getByLabelText('새 상한')).toHaveProperty('value', '1,000,000')
    expect(document.activeElement).toBe(screen.getByLabelText('새 상한'))
  })

  it('값을 고치면 그 문구가 사라진다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '1000000')
    await hold(750)
    await screen.findByText('이미 발행한 양보다 낮아요', {}, { timeout: 5000 })

    await user.clear(screen.getByLabelText('새 상한'))
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    expect(screen.queryByText('이미 발행한 양보다 낮아요')).toBeNull()
  })

  // 상한은 「여기까지만 희석된다」는 약속이다. 바꾸기 전에 무엇을 하는지 말한다.
  it('확정 전에 보유자에게 무엇을 하는지 보여준다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    expect(screen.getByText('가진 사람에게는')).toBeTruthy()
    expect(screen.getByText(/까지 늘어날 수 있게 돼요/)).toBeTruthy()
  })

  // 낮추는 것은 다시 바꾸는 것이지 취소가 아니다 — docs/JOURNEY.md 여정 9
  it('되돌린다는 말이 없다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    expect(document.body.textContent).not.toMatch(/되돌리|취소하기|복구/)
    expect(screen.getByText('바꾼 뒤에는 취소할 수 없어요')).toBeTruthy()
  })
})

describe('바뀐 사실은 가진 사람의 내역에 남는다', () => {
  it('발행자의 내역에 이체와 다른 모양으로 온다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(750)
    await atBank()

    // 은행 페이지는 플로우가 아니라 탭 바가 보인다.
    await user.click(await screen.findByRole('button', { name: '내역' }))

    const row = await screen.findByText('금머니 발행 상한이 올랐어요', {}, { timeout: 5000 })
    expect(screen.getByText(/10,000,000 → 20,000,000/)).toBeTruthy()
    // 눌러도 갈 곳이 없다 — 단건 조회는 이체만이다.
    expect(row.closest('button')).toBeNull()
  })

  // 발행자만 아는 변경은 약속이 아니다 — docs/JOURNEY.md 여정 8
  it('그 포인트를 가진 다른 사람의 내역에도 보인다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(750)
    await atBank()

    // @jisu 는 금머니를 가졌지만 발행자가 아니다.
    await signInAs('@jisu')
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '내역' }))
    expect(
      await screen.findByText('금머니 발행 상한이 올랐어요', {}, { timeout: 5000 }),
    ).toBeTruthy()
  })
})

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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

/**
 * 홈 → 금머니 은행 페이지 → 상한 바꾸기.
 *
 * 상한을 바꾸는 동안은 화면을 통째로 내준다 — 되돌릴 수 없는 확정을 다른 행동과
 * 나란히 두지 않는다. 근거: docs/MOTION.md 「공간의 배분」
 */
async function openChangeCap(user: ReturnType<typeof userEvent.setup>) {
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: '금머니 자세히' }))
  await user.click(await screen.findByRole('button', { name: '상한 바꾸기' }))
  await screen.findByLabelText('새 상한')
  await waitFor(() => expect(screen.getAllByRole('banner')).toHaveLength(1))
}

describe('상한을 바꾼다', () => {
  it('꾹 눌러서 바꾸면 은행 페이지로 돌아오고 상한이 바뀐다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(750)

    // 일이 끝나면 화면을 돌려준다.
    await screen.findByRole('heading', { name: '금머니' }, { timeout: 5000 })
    await user.click(await screen.findByRole('button', { name: '상한 바꾸기' }))
    await waitFor(() => expect(screen.getByText('20,000,000')).toBeTruthy())
  })

  // 만들기·발행과 같은 손동작이다. 다른 손동작을 요구하면 어느 것이 무거운지 알 수 없다.
  it('짧게 누르면 바뀌지 않는다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(200)
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.getByLabelText('새 상한')).toHaveProperty('value', '20,000,000')
    expect(screen.getByText('10,000,000')).toBeTruthy()
  })

  /*
   * 화면을 떠나지 않으므로 멱등성 키가 그 자리에 남는다. 물려주면 두 번째 변경이
   * 첫 번째의 재시도로 취급돼 조용히 아무 일도 일어나지 않는다.
   */
  it('두 번 바꾸면 두 번 다 바뀐다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(750)
    await screen.findByRole('heading', { name: '금머니' }, { timeout: 5000 })

    await user.click(await screen.findByRole('button', { name: '상한 바꾸기' }))
    await user.type(await screen.findByLabelText('새 상한'), '30000000')
    await hold(750)
    await screen.findByRole('heading', { name: '금머니' }, { timeout: 5000 })

    await user.click(await screen.findByRole('button', { name: '상한 바꾸기' }))
    await waitFor(() => expect(screen.getByText('30,000,000')).toBeTruthy())
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

  /*
   * 되돌릴 수 없는 확정이 엄지 자리에 상주하면 안 된다 — 고정된 자리는 그 화면의
   * 주된 행동이 앉는 자리다. 밀림은 화면을 통째로 내주는 것으로 푼다.
   * 근거: docs/MOTION.md 「공간의 배분」
   */
  it('확정 버튼이 화면 아래에 붙어 있지 않다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    const block = screen.getByRole('button', { name: '꾹 눌러서 바꾸기' }).parentElement!

    expect(getComputedStyle(block).position).not.toBe('sticky')
    expect(getComputedStyle(block).position).not.toBe('fixed')
  })

  // 상한을 바꾸는 동안 발행·보내기로 새는 길을 두지 않는다.
  it('그동안 다른 행동이 화면에 없다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)

    expect(screen.queryByRole('button', { name: '발행하기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '보내기' })).toBeNull()
  })

  // 낮추는 것은 다시 바꾸는 것이지 취소가 아니다 — docs/JOURNEY.md 여정 9
  it('되돌린다는 말이 없다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    expect(document.body.textContent).not.toMatch(/되돌리|취소하기|복구/)
    // 「취소」라는 말 자체를 쓰지 않는다. 실제로 일어나는 것을 말한다.
    expect(document.body.textContent).not.toContain('취소')
    expect(screen.getByText('낮춰도 이미 발행된 것은 돌아오지 않아요')).toBeTruthy()
  })
})

/*
 * 전기가 없어 사건이 아니다 — 원장 밖에 남는다(docs/LEDGER.md 4 단계). 그래서 줄이
 * 아니고, 대신 **지금 상한**이 은행 페이지에 늘 온다. 「안 보인다」만 재면 상한 변경
 * 자체가 조용히 실패해도 통과하므로, 바뀐 값을 먼저 보고 나서 내역을 본다.
 */
describe('바뀐 사실은 내역에 오르지 않는다', () => {
  it('바꾼 사람의 내역에도 줄이 생기지 않는다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(750)
    await screen.findByRole('heading', { name: '금머니' }, { timeout: 5000 })
    expect(await screen.findByText('20,000,000')).toBeTruthy()

    // 은행 페이지는 플로우가 아니라 탭 바가 보인다.
    await user.click(await screen.findByRole('button', { name: '내역' }))
    expect(await screen.findByText('아직 보낸 것이 없어요', {}, { timeout: 5000 })).toBeTruthy()
  })

  // 보유자의 내역이 발행자의 관리 기록으로 채워지지 않는다 — docs/JOURNEY.md 여정 8
  it('그 포인트를 가진 다른 사람의 내역에도 없다', async () => {
    const user = userEvent.setup()
    await openChangeCap(user)
    await user.type(screen.getByLabelText('새 상한'), '20000000')
    await hold(750)
    await screen.findByRole('heading', { name: '금머니' }, { timeout: 5000 })

    /*
     * @jisu 는 금머니를 가졌지만 발행자가 아니다. 다시 그리면 주소가 그대로라 같은
     * 은행 페이지가 열린다 — 앞 화면이 함께 떠 있어 이름이 겹치므로 새 쪽만 본다.
     */
    await signInAs('@jisu')
    const jisu = within(renderApp(<App />).container)
    // 상한은 보유자에게도 온다. 변경이 내역에서 빠져도 지금 값을 아는 길은 남는다.
    expect(await jisu.findByText('20,000,000', {}, { timeout: 5000 })).toBeTruthy()

    await user.click(await jisu.findByRole('button', { name: '내역' }))
    expect(await jisu.findByText('아직 보낸 것이 없어요', {}, { timeout: 5000 })).toBeTruthy()
  })
})

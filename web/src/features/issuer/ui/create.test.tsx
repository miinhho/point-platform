// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 여정 9 */

beforeEach(async () => {
  await signInAs()
})

/** 홀드를 ms 만큼 누른다. 600ms 를 넘겨야 발동한다 */
async function hold(ms: number) {
  const button = screen.getByRole('button', { name: '꾹 눌러서 만들기' })
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, ms))
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, symbol = 'BK') {
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
  await user.type(await screen.findByLabelText('이름'), '동네빵집')
  await user.type(screen.getByLabelText('기호'), symbol)
  await user.type(screen.getByLabelText('발행 상한'), '1000000')
}

describe('포인트를 만든다', () => {
  it('만든 즉시 홈 목록에 그 카드가 있다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await hold(750)

    expect(await screen.findByText('만들었어요', {}, { timeout: 5000 })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '홈으로' }))

    expect(await screen.findByText('동네빵집', {}, { timeout: 5000 })).toBeTruthy()
    // 잔액 0 이라도 발행 진입점이 붙는다. 없으면 발행하러 갈 길이 없다.
    // 시드의 금머니에 하나, 방금 만든 것에 하나.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: '발행 관리' })).toHaveLength(2),
    )
  })

  it('겹친 기호는 그 자리에서 말한다 — 실패 화면으로 보내지 않는다', async () => {
    const user = userEvent.setup()
    await fillForm(user, 'ON')
    await hold(750)

    expect(await screen.findByText('이미 쓰는 기호예요', {}, { timeout: 5000 })).toBeTruthy()
    // 입력을 잃지 않는다. 기호만 고치면 된다.
    expect(screen.getByLabelText('이름')).toHaveProperty('value', '동네빵집')
    expect(screen.getByText('포인트 만들기')).toBeTruthy()
  })

  it('확정 전에 카드 모습을 보여준다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    const preview = screen.getByText('이렇게 보여요').parentElement!
    expect(preview.textContent).toContain('동네빵집')
    expect(preview.textContent).toContain('BK')
  })

  it('짧게 누르면 만들어지지 않는다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await hold(200)
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.getByText('포인트 만들기')).toBeTruthy()
  })

  it('빈 폼으로는 확정할 수 없다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    expect(screen.getByRole('button', { name: '꾹 눌러서 만들기' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('소문자로 쳐도 대문자로 보인다 — 화면과 결과가 같아야 한다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    await user.type(await screen.findByLabelText('기호'), 'bk')
    expect(screen.getByLabelText('기호')).toHaveProperty('value', 'BK')
  })

  it('만든 것을 지우는 경로가 없다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await hold(750)
    await screen.findByText('만들었어요', {}, { timeout: 5000 })

    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(labels.filter((label) => /지우|삭제|없애/.test(label))).toEqual([])
  })
})

describe('되돌릴 수 없다고 먼저 말한다', () => {
  it('확정 버튼 옆에 그 말이 있다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await waitFor(() => expect(screen.getByText('만든 뒤에는 지울 수 없어요')).toBeTruthy())
  })
})

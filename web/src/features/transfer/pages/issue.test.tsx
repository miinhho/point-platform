// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { balanceOf, SEED_ISSUER as ME } from '@/mocks/ledger'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

beforeEach(async () => {
  await signInAs()
})

/** 확인 방법: docs/JOURNEY.md 여정 7 */
async function settle() {
  await waitFor(() => expect(screen.getAllByRole('banner').length).toBeLessThan(2), {
    timeout: 3000,
  })
}

/** 금액 화면까지. 금머니만 내가 발행한다 */
async function atAmount() {
  const user = userEvent.setup()
  renderApp(<App />)
  // 카드의 진입점 → 은행 페이지 → 발행하기 (도구는 그 페이지 안에 모인다)
  await user.click(await screen.findByRole('button', { name: '금머니 자세히' }))
  await user.click(await screen.findByRole('button', { name: '발행하기' }))
  await screen.findByText(/만큼 발행할 수 있어요/)
  await settle()
  return user
}

async function startIssue(amount = '100000') {
  const user = await atAmount()
  for (const d of amount) await user.click(screen.getByRole('button', { name: d }))
  await user.click(screen.getByRole('button', { name: '발행 확인' }))
  await screen.findByText('이렇게 발행할까요?')
  await settle()
  return user
}

async function hold(ms: number) {
  const button = screen.getByRole('button', { name: '꾹 눌러서 발행' })
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, ms))
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
}

describe('여정 7 — 발행', () => {
  it('대상을 고르지 않는다. 자기 지갑으로만 들어간다', async () => {
    await startIssue()
    // 대상 선택 화면을 지나지 않았다
    expect(screen.queryByText('누구에게 보낼까요?')).toBeNull()
    expect(screen.queryByText('받는 사람')).toBeNull()
  })

  it('발행 경로 전체에 "잔액" 이라는 말이 없다', async () => {
    await startIssue()
    expect(document.body.textContent).not.toContain('잔액')
    expect(document.body.textContent).toContain('총 유통량')
  })

  it('상한이 잔액이 아니라 남은 발행 여력이다', async () => {
    await atAmount()
    // 금머니: 상한 1000만 - 발행량 120만 = 880만. 내 잔액 62만이 아니다
    expect(document.body.textContent).toContain('8,800,000')
    expect(document.body.textContent).not.toContain('620,000')
  })

  it('발행 뒤 총 유통량과 변화율을 보여준다', async () => {
    await startIssue()
    expect(screen.getByText('1,200,000')).toBeTruthy()
    expect(screen.getByText('1,300,000')).toBeTruthy()
    expect(screen.getByText(/\+8\.3%/)).toBeTruthy()
  })

  /*
   * 발행 화면은 이체 화면을 빌려 쓰지 않는다. 빌려 쓰면 「받는 사람」 칸이 남고,
   * 빈칸은 채워지려 한다 — 규칙: CLAUDE.md 「비어야 할 칸은 비운다」
   */
  it('화면마다 제목이 발행이라고 말한다', async () => {
    const user = await atAmount()
    expect(screen.getByRole('button', { name: '발행 확인' })).toBeTruthy()

    for (const digit of '100000') await user.click(screen.getByRole('button', { name: digit }))
    await user.click(screen.getByRole('button', { name: '발행 확인' }))
    expect(await screen.findByText('이렇게 발행할까요?')).toBeTruthy()
    await settle()
    expect(screen.getByRole('button', { name: '꾹 눌러서 발행' })).toBeTruthy()
  })

  it('발행이 실패하면 「보내지 못했어요」라고 하지 않는다', async () => {
    server.use(
      http.post('*/api/issues', () =>
        HttpResponse.json(
          { code: 'CAP_EXCEEDED', outcome: 'none', message: '' },
          { status: 409 },
        ),
      ),
    )
    await startIssue()
    await hold(750)

    expect(await screen.findByText('발행하지 못했어요', {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.queryByText('보내지 못했어요')).toBeNull()
    // 발행에는 받는 사람이 없다. 그 줄을 비운다
    expect(screen.getByText('발행하려던 것')).toBeTruthy()
    expect(document.body.textContent).not.toContain('@minho')
  })

  it('확정하면 내 지갑으로 들어오고 유통량이 늘어난다', async () => {
    const before = balanceOf('pt_gm', ME)
    await startIssue()
    await hold(750)

    expect(await screen.findByText('발행했어요', {}, { timeout: 3000 })).toBeTruthy()
    expect(balanceOf('pt_gm', ME)).toBe(before + 100_000)
    expect(document.body.textContent).toContain('총 유통량')
    expect(document.body.textContent).not.toContain('남은 잔액')
  })
})

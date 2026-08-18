// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { balanceOf, ME } from '@/mocks/ledger'
import { renderApp } from '@/test/render'
import App from '@/app/App'

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
  // 카드 배지 → 발행자 화면 → 발행하기 (여정 8 — 도구는 그 안에 모인다)
  await user.click(await screen.findByRole('button', { name: '발행 관리' }))
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

  it('발행 띠가 모든 발행 화면에 붙는다 — 색이 아니라 구조로 구분한다', async () => {
    await startIssue()
    expect(screen.getByText('발행')).toBeTruthy()
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

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { balanceOf, ME } from '@/mocks/ledger'
import { setSim } from '@/mocks/sim'
import { renderApp } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 여정 5·6 */
async function settle() {
  await waitFor(() => expect(screen.getAllByRole('banner').length).toBeLessThan(2), {
    timeout: 3000,
  })
}

async function atConfirm(amount = '30000') {
  const user = userEvent.setup()
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: /온포인트.*3,240,000/ }))
  await screen.findByText('누구에게 보낼까요?')
  await user.click(await screen.findByRole('button', { name: /@jisoo/ }))
  await screen.findByText(/보낼 수 있어요/)
  for (const d of amount) await user.click(screen.getByRole('button', { name: d }))
  await user.click(screen.getByRole('button', { name: '보내기 확인' }))
  await screen.findByText('이렇게 보낼까요?')
  await settle()
  return user
}

function holdButton() {
  return screen.getByRole('button', { name: '꾹 눌러서 보내기' })
}

/** 홀드를 ms 만큼 누른다. 600ms 를 넘겨야 발동한다 */
async function hold(ms: number) {
  const button = holdButton()
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, ms))
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
}

describe('여정 5 — 확정 화면이 마지막 방어선이다', () => {
  it('다섯 항목이 전부 있다', async () => {
    await atConfirm()
    for (const text of ['온포인트', '김지수', '@jisoo', '30,000', '3,210,000']) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0)
    }
  })

  it('확인 다이얼로그가 0개다', async () => {
    await atConfirm()
    expect(screen.queryAllByRole('dialog')).toEqual([])
    expect(screen.queryAllByRole('alertdialog')).toEqual([])
  })

  it('200ms 에서 떼면 발동하지 않는다', async () => {
    await atConfirm()
    await hold(200)
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.getByText('이렇게 보낼까요?')).toBeTruthy()
  })

  it('끝까지 누르면 보내지고 잔액이 움직인다', async () => {
    await atConfirm()
    await hold(750)
    expect(await screen.findByText('보냈어요', {}, { timeout: 3000 })).toBeTruthy()
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
  })
})

describe('요청이 나가는 동안', () => {
  // 여기서 금액 화면으로 돌아가면 사용자는 취소된 줄 알고, 확정은 서버에서 그대로 일어난다.
  it('back 이 화면을 바꾸지 않는다', async () => {
    await atConfirm()
    setSim({ latencyMs: 600, jitterMs: 0 })

    const button = holdButton()
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 700))
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

    // 요청이 나가는 중이다. 히스토리 back 을 흉내낸다.
    await new Promise((resolve) => setTimeout(resolve, 100))
    dispatchEvent(new PopStateEvent('popstate'))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(screen.getByText('이렇게 보낼까요?')).toBeTruthy()

    // 끝나면 결과가 나온다
    expect(await screen.findByText('보냈어요', {}, { timeout: 4000 })).toBeTruthy()
  })

  it('홀드를 두 번 완료해도 두 번 보내지 않는다', async () => {
    await atConfirm()
    setSim({ latencyMs: 500, jitterMs: 0 })
    await hold(750)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await hold(750)
    await screen.findByText('보냈어요', {}, { timeout: 4000 })
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
  })
})

describe('멱등성 키 — 금액을 고치면 다른 이체다', () => {
  it('확정에서 뒤로 가 금액을 고치면 새 금액으로 다시 확정한다', async () => {
    const user = await atConfirm()
    await user.click(screen.getAllByRole('button', { name: '뒤로' })[0])
    await screen.findByText(/보낼 수 있어요/)
    await settle()

    await user.click(screen.getByRole('button', { name: '0' }))
    await user.click(screen.getByRole('button', { name: '보내기 확인' }))
    await screen.findByText('이렇게 보낼까요?')
    await settle()
    expect(screen.getAllByText('300,000').length).toBeGreaterThan(0)
  })
})

describe('여정 6 — 결과를 모를 때 단정하지 않는다', () => {
  it('네트워크 실패는 "실패했습니다" 라고 말하지 않는다', async () => {
    await atConfirm()
    setSim({ forceFailure: 'NETWORK' })
    await hold(750)

    expect(await screen.findByText('서버에 닿지 못했어요', {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText('지금 확실한 것')).toBeTruthy()
    expect(screen.getByText(/보내졌는지 알 수 없어요/)).toBeTruthy()
    // 재시도가 아니라 확인이다
    expect(screen.getByRole('button', { name: '확인하기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '다시 보내기' })).toBeNull()
  })

  // 잔액 초과는 금액 화면이 이미 막으므로, 서버가 거절하는 경로를 주입으로 만든다.
  it('결과를 아는 실패는 아무것도 나가지 않았다고 단정한다', async () => {
    await atConfirm()
    setSim({ forceFailure: 'INSUFFICIENT_BALANCE' })
    await hold(750)
    expect(await screen.findByText('잔액이 부족해요', {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText('포인트는 여기 있어요')).toBeTruthy()
    expect(screen.getByText('아무것도 나가지 않았어요')).toBeTruthy()
  })

  it('입력을 버리지 않는다', async () => {
    await atConfirm()
    setSim({ forceFailure: 'NETWORK' })
    await hold(750)
    await screen.findByText('서버에 닿지 못했어요', {}, { timeout: 3000 })

    expect(screen.getByText('보내려던 것')).toBeTruthy()
    expect(screen.getAllByText('김지수').length).toBeGreaterThan(0)
    expect(screen.getAllByText('30,000').length).toBeGreaterThan(0)
  })

  // 서버는 만들었고 클라이언트는 못 받았다. 멱등성이 실제로 시험되는 경로다.
  it('응답이 유실됐으면 확인하기가 완료로 데려간다 — 잔액은 한 번만 움직인다', async () => {
    const user = await atConfirm()
    setSim({ loseNextResponse: true })
    await hold(750)
    await screen.findByText('서버에 닿지 못했어요', {}, { timeout: 3000 })
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)

    await user.click(screen.getByRole('button', { name: '확인하기' }))
    expect(await screen.findByText('보냈어요', {}, { timeout: 3000 })).toBeTruthy()
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
  })
})

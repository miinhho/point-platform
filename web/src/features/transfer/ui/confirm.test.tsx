// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { balanceOf, SEED_ISSUER as ME } from '@/mocks/ledger'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { setSim } from '@/mocks/sim'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

beforeEach(async () => {
  await signInAs()
})

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
  await screen.findByText(/만큼 보낼 수 있어요/)
  for (const d of amount) await user.click(screen.getByRole('button', { name: d }))
  // 키 입력이 하나라도 빠지면 뒤의 단정이 엉뚱한 숫자를 기다린다.
  await screen.findByText(Number(amount).toLocaleString('ko-KR'))
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
    // 보낸 뒤 남는 잔액은 지갑 응답이 온 뒤에 나온다.
    await screen.findByText('3,210,000')
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
    expect(await screen.findByText('보냈어요', {}, { timeout: 5000 })).toBeTruthy()
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

  // 화면은 그대로 두는 것이 여정 5 의 결정이다. 그러면 소리가 유일한 통로가 된다.
  it('진행 중이라는 사실이 소리로 전해진다', async () => {
    await atConfirm()
    setSim({ latencyMs: 800, jitterMs: 0 })
    await hold(750)
    expect(await screen.findByText('보내고 있어요')).toBeTruthy()
    await screen.findByText('보냈어요', {}, { timeout: 5000 })
    await waitFor(() => expect(screen.queryByText('보내고 있어요')).toBeNull())
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
    await screen.findByText(/만큼 보낼 수 있어요/)
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

    expect(await screen.findByText('서버에 닿지 못했어요', {}, { timeout: 5000 })).toBeTruthy()
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
    expect(await screen.findByText('잔액이 부족해요', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByText('포인트는 여기 있어요')).toBeTruthy()
    expect(screen.getByText('아무것도 나가지 않았어요')).toBeTruthy()
  })

  it('입력을 버리지 않는다', async () => {
    await atConfirm()
    setSim({ forceFailure: 'NETWORK' })
    await hold(750)
    await screen.findByText('서버에 닿지 못했어요', {}, { timeout: 5000 })

    expect(screen.getByText('보내려던 것')).toBeTruthy()
    expect(screen.getAllByText('김지수').length).toBeGreaterThan(0)
    expect(screen.getAllByText('30,000').length).toBeGreaterThan(0)
  })

  // 서버는 만들었고 클라이언트는 못 받았다. 멱등성이 실제로 시험되는 경로다.
  it('응답이 유실됐으면 확인하기가 완료로 데려간다 — 잔액은 한 번만 움직인다', async () => {
    const user = await atConfirm()
    setSim({ loseNextResponse: true })
    await hold(750)
    await screen.findByText('서버에 닿지 못했어요', {}, { timeout: 5000 })
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)

    await user.click(screen.getByRole('button', { name: '확인하기' }))
    expect(await screen.findByText('보냈어요', {}, { timeout: 5000 })).toBeTruthy()
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
  })
})

/*
 * 공개 은행에는 관문이 없어 카드가 조용히 늘어난다. 진짜 위험이 실현되는 것은
 * 그 포인트의 대가로 무언가를 줄 때이고, 그 직전이 마지막 방어선이다.
 * 근거: docs/JOURNEY.md 여정 10
 */
describe('처음 쓰는 포인트', () => {
  /** 온포인트(솔카페)만 받기만 하고 써 본 적이 없다 */
  async function atFirstUse() {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /온포인트.*12,000/ }))
    await screen.findByText('누구에게 보낼까요?')
    await user.click(await screen.findByRole('button', { name: /@jisoo/ }))
    await screen.findByText(/만큼 보낼 수 있어요/)
    for (const d of '1000') await user.click(screen.getByRole('button', { name: d }))
    await user.click(screen.getByRole('button', { name: '보내기 확인' }))
    await screen.findByText('이렇게 보낼까요?')
    await settle()
    return user
  }

  it('처음임을 말하고 흉내낼 수 없는 것을 함께 보여준다', async () => {
    await atFirstUse()

    expect(screen.getByText('이 포인트를 처음 써요')).toBeTruthy()
    // 이름도 기호도 색도 흉내낼 수 있다. 핸들만 하나뿐이다.
    expect(screen.getByText('@solcafe')).toBeTruthy()
  })

  it('이미 써 본 포인트에는 나오지 않는다', async () => {
    await atConfirm()
    expect(screen.queryByText('이 포인트를 처음 써요')).toBeNull()
  })
})

/*
 * 잔액 0 이면서 발행자가 아닌 포인트는 지갑 목록에서 빠진다. **전액을 보내면 정확히
 * 그 상태가 된다** — 두 종류의 0 중 하나가 실제로 만들어지는 유일한 순간이고, 그때
 * 화면이 「남은 잔액」이라 써 놓고 옆을 비우면 못 불러온 것과 구별되지 않는다.
 * 규칙: CLAUDE.md · 근거: docs/JOURNEY.md 여정 1
 */
describe('전액을 보내면 남은 잔액이 0 이다', () => {
  it('빈칸이 아니라 0 이라고 쓴다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /온포인트.*3,240,000/ }))
    await user.click(await screen.findByRole('button', { name: /@jisoo/ }))
    await screen.findByText(/만큼 보낼 수 있어요/)

    for (const digit of '3240000') await user.click(screen.getByRole('button', { name: digit }))
    await user.click(screen.getByRole('button', { name: '보내기 확인' }))
    await screen.findByText('이렇게 보낼까요?')
    await settle()
    await hold(750)

    await screen.findByText('보냈어요', {}, { timeout: 5000 })
    const label = await screen.findByText('남은 잔액')
    const row = label.parentElement!
    await waitFor(() => expect(row.textContent).toContain('0'))
  })

  // 못 불러온 것과 0 이 같아 보이면 안 된다.
  it('잔액을 못 불러오면 0 이라고 쓰지 않는다', async () => {
    const user = await atConfirm()
    server.use(http.get('*/api/wallet', () => HttpResponse.error()))
    await hold(750)

    await screen.findByText('보냈어요', {}, { timeout: 5000 })
    expect(await screen.findByText('잔액을 못 불러왔어요')).toBeTruthy()
  })
})

/*
 * 못 불러온 잔액을 0 으로 접으면 「보낸 뒤 남는 잔액」이 음수가 된다 — 되돌릴 수 없는
 * 것 직전에 화면이 거짓을 말한다.
 */
describe('확정 화면은 모르는 잔액을 0 으로 쓰지 않는다', () => {
  it('지갑을 못 불러오면 숫자를 쓰지 않는다', async () => {
    server.use(http.get('*/api/wallet', () => HttpResponse.error()))
    const user = userEvent.setup()
    renderApp(<App />)
    await screen.findByRole('alert')

    expect(user).toBeTruthy()
    expect(screen.queryByText('보낸 뒤 남는 잔액')).toBeNull()
  })
})

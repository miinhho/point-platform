// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { endpoints } from '@/api/endpoints'
import { newIdempotencyKey } from '@/api/http'
import { renderApp } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 여정 8 */
async function settle() {
  await waitFor(() => expect(screen.getAllByRole('banner').length).toBeLessThan(2), {
    timeout: 3000,
  })
}

async function openHistory() {
  const user = userEvent.setup()
  renderApp(<App />)
  await screen.findByText('내 포인트')
  await user.click(screen.getByRole('button', { name: '내역' }))
  await settle()
  return user
}

describe('탭', () => {
  it('셋이고 역할과 무관하게 같다', async () => {
    renderApp(<App />)
    await screen.findByText('내 포인트')
    for (const name of ['홈', '내역', '설정']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('플로우 안에서는 탭이 사라진다 — 되돌릴 수 없는 길에서 새지 않게', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /온포인트.*3,240,000/ }))
    await screen.findByText('누구에게 보낼까요?')
    await settle()
    expect(screen.queryByRole('button', { name: '설정' })).toBeNull()
  })
})

describe('내역', () => {
  it('비어 있으면 그렇게 말한다', async () => {
    await openHistory()
    expect(await screen.findByText('아직 보낸 것이 없어요')).toBeTruthy()
  })

  it('보낸 것이 보이고 상세로 들어간다', async () => {
    await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 },
      newIdempotencyKey(),
    )
    const user = await openHistory()

    const row = await screen.findByRole('button', { name: /30,000/ })
    await user.click(row)
    expect(await screen.findByText('이체 내역')).toBeTruthy()
    // 두 번 보내지지 않았다를 확인할 수 있는 근거다
    expect(screen.getByText('요청 키')).toBeTruthy()
  })

  // 되돌리는 버튼이 있으면 앱 전체가 "사실 되돌릴 수 있다" 는 전제 위에 선다.
  it('상세에 되돌리는 경로가 없다', async () => {
    await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 1_000 },
      newIdempotencyKey(),
    )
    const user = await openHistory()
    await user.click(await screen.findByRole('button', { name: /1,000/ }))
    await screen.findByText('이체 내역')

    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    for (const banned of ['취소', '되돌', '반환', '환불']) {
      expect(labels.join(' ')).not.toContain(banned)
    }
  })

  it('발행 내역에는 발행 띠가 붙고 보낸 사람이 무에서다', async () => {
    await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 5_000 }, newIdempotencyKey())
    const user = await openHistory()
    await user.click(await screen.findByRole('button', { name: /5,000/ }))
    await screen.findByText('발행 내역')
    expect(screen.getByText('발행 (무에서)')).toBeTruthy()
  })
})

describe('설정', () => {
  it('색 모드가 3택이다 — 2택이면 시스템으로 돌아갈 길이 없다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await screen.findByText('내 포인트')
    await user.click(screen.getByRole('button', { name: '설정' }))
    await settle()

    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['자동', '밝게', '어둡게'])
  })
})

describe('발행자 화면', () => {
  it('유통량·상한·여력을 보여준다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '발행 관리' }))
    await screen.findByText('발행 관리')
    expect(screen.getByText('8,800,000')).toBeTruthy()
  })

  it('보유자 화면에는 유통량이 나오지 않는다', async () => {
    renderApp(<App />)
    await screen.findByText('내 포인트')
    expect(document.body.textContent).not.toContain('총 유통량')
    expect(document.body.textContent).not.toContain('발행 상한')
  })
})

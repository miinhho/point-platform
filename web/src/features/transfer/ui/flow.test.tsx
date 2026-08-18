// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderApp } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 여정 2·3·4 */

/** 전환 중에는 두 화면이 함께 떠 있다. 하나만 남을 때까지 기다린다. */
async function settle(): Promise<void> {
  await waitFor(() => expect(screen.getAllByRole('banner')).toHaveLength(1), { timeout: 3000 })
}

function currentHeader(): string {
  return screen.getByRole('banner').textContent ?? ''
}
async function openPicker() {
  const user = userEvent.setup()
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: /온포인트.*3,240,000/ }))
  await screen.findByText('누구에게 보낼까요?')
  await settle()
  return user
}

describe('여정 2 — 홈 카드로 들어간다', () => {
  it('카드를 누르면 대상 선택이고 고른 포인트가 헤더에 남는다', async () => {
    await openPicker()
    expect(currentHeader()).toContain('온포인트')
  })

  it('잔액 0 카드는 누를 수 없다', async () => {
    server.use(
      http.get('*/api/wallet', () =>
        HttpResponse.json({
          user: { id: 'u_minho', name: '장민호', handle: '@minho' },
          balances: [
            {
              pointType: {
                id: 'pt_z',
                name: '영포인트',
                symbol: 'ZZ',
                issuerId: 'u_x',
                issuerName: '어딘가',
                accent: 'pink',
                totalIssued: 1,
                issueCap: 2,
              },
              amount: 0,
            },
          ],
        }),
      ),
    )
    renderApp(<App />)
    await screen.findByText('영포인트')
    expect(screen.queryByRole('button', { name: /영포인트/ })).toBeNull()
  })
})

describe('여정 3 — 받는 사람', () => {
  // 안내 문구는 뺐다. 나란히 놓인 두 줄과 강조된 핸들이 그 일을 한다.
  it('동명이인 두 명이 나란히 온다', async () => {
    await openPicker()
    const rows = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    const first = rows.findIndex((t) => t.includes('@jisoo'))
    const second = rows.findIndex((t) => t.includes('@jisu'))
    expect(second).toBe(first + 1)
  })

  it('최근으로 끌어올린 줄은 보낸 적 없다고 말한다', async () => {
    await openPicker()
    expect(screen.getByText('보낸 적 없음')).toBeTruthy()
  })

  // 결과 안에서만 겹침을 세면 여기서 방어가 꺼진다.
  it('핸들로 검색해 한 명만 맞아도 동명이인이 함께 보인다', async () => {
    const user = await openPicker()
    await user.type(screen.getByPlaceholderText('이름 또는 핸들'), '@jisu')
    expect(await screen.findByText('@jisoo')).toBeTruthy()
  })

  it('찾는 사람이 없으면 그렇게 말한다', async () => {
    const user = await openPicker()
    await user.type(screen.getByPlaceholderText('이름 또는 핸들'), '없는이름')
    expect(await screen.findByText('"없는이름"로 찾은 사람이 없어요')).toBeTruthy()
  })

  it('검색창에 자동 포커스가 없다', async () => {
    await openPicker()
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText('이름 또는 핸들'))
  })
})

describe('여정 4 — 금액', () => {
  async function atAmount() {
    const user = await openPicker()
    await user.click(screen.getByRole('button', { name: /@jisoo/ }))
    await screen.findByText('3,240,000만큼 보낼 수 있어요')
    await settle()
    return user
  }

  it('받는 사람과 포인트가 함께 보인다', async () => {
    await atAmount()
    expect(currentHeader()).toContain('김지수')
    expect(screen.getByText('온포인트')).toBeTruthy()
  })

  it('숫자와 한글이 함께 읽힌다', async () => {
    const user = await atAmount()
    for (const d of '30000') await user.click(screen.getByRole('button', { name: d }))
    expect(screen.getByText('30,000')).toBeTruthy()
    expect(screen.getByText('3만')).toBeTruthy()
  })

  it('150만과 1500만이 다르게 읽힌다', async () => {
    const user = await atAmount()
    for (const d of '1500000') await user.click(screen.getByRole('button', { name: d }))
    expect(screen.getByText('150만')).toBeTruthy()
  })

  it('전체삭제 한 번이면 처음으로 돌아간다', async () => {
    const user = await atAmount()
    for (const d of '12345') await user.click(screen.getByRole('button', { name: d }))
    await user.click(screen.getByRole('button', { name: '전체삭제' }))
    // 병기가 사라지고 확인이 다시 잠기는 것이 "처음" 이다.
    expect(screen.queryByText('1만 2,345')).toBeNull()
    expect(screen.getByRole('button', { name: '보내기 확인' })).toHaveProperty('disabled', true)
  })

  it('잔액을 넘으면 그렇게 말하고 확인이 잠긴다 — 버튼을 감추지는 않는다', async () => {
    const user = await atAmount()
    for (const d of '99999999') await user.click(screen.getByRole('button', { name: d }))
    expect(screen.getByText(/잔액을 넘었어요/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '보내기 확인' })).toHaveProperty('disabled', true)
  })

  it('0 원이면 확인이 잠긴다', async () => {
    await atAmount()
    expect(screen.getByRole('button', { name: '보내기 확인' })).toHaveProperty('disabled', true)
  })
})

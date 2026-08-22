// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

beforeEach(async () => {
  await signInAs()
})

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
    // 옆의 은행 페이지 진입점은 살아 있다 — 누를 수 없는 것은 카드다.
    const cards = screen
      .queryAllByRole('button', { name: /영포인트/ })
      .filter((button) => !button.getAttribute('aria-label'))
    expect(cards).toEqual([])
  })
})

/*
 * 여정 2 — 이름이 겹치는 포인트를 골랐으면 발행자가 함께 따라다닌다.
 * 온포인트는 원장에 둘이다(온마트/솔카페). 이름만으로는 무엇인지 말하지 못한다.
 */
describe('여정 2 — 겹치는 이름은 발행자가 따라다닌다', () => {
  async function toConfirmWithSharedName() {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /온포인트.*3,240,000/ }))
    await screen.findByText('누구에게 보낼까요?')
    await settle()
    return user
  }

  it('대상 선택 화면에 발행자가 붙는다', async () => {
    await toConfirmWithSharedName()
    expect(currentHeader()).toContain('온마트 발행')
  })

  it('금액 화면과 확정 화면까지 따라간다', async () => {
    const user = await toConfirmWithSharedName()
    await user.click(await screen.findByRole('button', { name: /@jisoo/ }))
    await screen.findByText(/만큼 보낼 수 있어요/)
    await settle()
    expect(screen.getByText('온마트 발행')).toBeTruthy()

    for (const digit of '30000') await user.click(screen.getByRole('button', { name: digit }))
    await screen.findByText('30,000')
    await user.click(screen.getByRole('button', { name: '보내기 확인' }))

    // 마지막 방어선이다. 여기서 어느 온포인트인지 말하지 못하면 다른 방어선이 없다.
    await screen.findByText('이렇게 보낼까요?')
    await settle()
    expect(screen.getByText('온마트 발행')).toBeTruthy()
  })

  // 항상 붙이면 배경이 되어 정작 겹칠 때 눈에 띄지 않는다.
  it('겹치지 않는 포인트에는 안 붙는다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /금머니.*620,000/ }))
    await screen.findByText('누구에게 보낼까요?')
    await settle()
    expect(screen.queryByText('장민호 발행')).toBeNull()
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

  it('핸들로 검색하면 그 한 명만 나온다 — 모르는 동명이인이 딸려 오지 않는다', async () => {
    const user = await openPicker()
    await user.type(screen.getByPlaceholderText('이름 또는 핸들'), '@jisu')
    expect(await screen.findByText('@jisu')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('@jisoo')).toBeNull())
  })

  /*
   * 비교할 옆줄이 사라진 자리다. 전에는 동명이인 둘이 나란히 와서 「겹친다」를 배치가
   * 말했고, 이제는 한 줄뿐이라 **핸들 하나가 그 일을 한다.** 무엇으로 강조하는지는
   * `system.ts` 가 정한다 — `handleVerify` 는 `handle` 보다 크고 굵고 색이 다르다
   * (색만으로 가르지 않는다). 여기서 재는 것은 화면이 그 갈래를 실제로 타는가다.
   */
  it('한 명만 나와도 겹치는 이름의 핸들은 안 겹치는 핸들과 다르게 그려진다', async () => {
    const user = await openPicker()
    await user.type(screen.getByPlaceholderText('이름 또는 핸들'), '@j')
    const shared = await screen.findByText('@jisu')
    const plain = screen.getByText('@junho')
    expect(shared.className).not.toBe(plain.className)
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

/*
 * 비공개 은행에서 회원이 아닌 사람은 없는 사람과 구별되지 않아야 한다. 목록에서
 * 빼는 것이 「회원이 아니에요」라고 말하는 것보다 낫다 — 계약: docs/API.md
 */
describe('비공개 은행에서는 회원만 고를 수 있다', () => {
  it('회원이 아닌 사람은 목록에 없다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /동아리회비.*50,000/ }))
    await screen.findByText('누구에게 보낼까요?')

    // `pt_cl` 의 회원은 나와 `@jisoo` 뿐이다.
    expect(await screen.findByText('@jisoo')).toBeTruthy()
    expect(screen.queryByText('@taeyun')).toBeNull()
    expect(screen.queryByText('@seoyeon')).toBeNull()
  })

  it('공개 은행에서는 좁히지 않는다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: /금머니.*620,000/ }))
    await screen.findByText('누구에게 보낼까요?')

    expect(await screen.findByText('@taeyun')).toBeTruthy()
  })
})

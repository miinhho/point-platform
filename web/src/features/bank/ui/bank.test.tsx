// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 「은행 페이지」 · 여정 10 */

beforeEach(async () => {
  await signInAs()
})

/** 카드와 그 옆의 진입점은 이름이 겹친다 — 카드는 `aria-label` 이 없는 쪽이다 */
function cardOf(name: string): HTMLElement {
  return screen
    .getAllByRole('button', { name: new RegExp(name) })
    .filter((button) => !button.getAttribute('aria-label'))[0]
}

async function openBank(name: string) {
  const user = userEvent.setup()
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: `${name} 자세히` }))
  await screen.findByRole('heading', { name })
  // 전환 중에는 두 화면이 함께 떠 있다. 홈 카드의 값이 은행 페이지의 것으로 읽힌다.
  await waitFor(() => expect(screen.getAllByRole('banner')).toHaveLength(1))
  return user
}

describe('은행 페이지', () => {
  // 판단의 근거는 핸들이다. 이름도 기호도 색도 흉내낼 수 있다.
  it('흉내낼 수 없는 것을 보여준다 — 핸들·만든 날·유통량', async () => {
    await openBank('금머니')

    expect(screen.getByText('@minho')).toBeTruthy()
    expect(screen.getByText('만든 날')).toBeTruthy()
    expect(screen.getByText('1,200,000')).toBeTruthy()
  })

  it('발행자에게는 상한과 여력이 함께 온다', async () => {
    await openBank('금머니')

    expect(screen.getByText('10,000,000')).toBeTruthy()
    expect(screen.getByText('8,800,000')).toBeTruthy()
    expect(screen.getByRole('button', { name: '발행하기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '상한 바꾸기' })).toBeTruthy()
  })

  // 처음 만나는 순간에는 유통량이 판단을 가른다 — 여정 8 의 「소음」은 이미 쓰는 포인트 이야기다.
  it('발행자가 아닌 사람이 열어도 소개가 보인다', async () => {
    await signInAs('@jisu')
    await openBank('금머니')

    expect(screen.getByText('@minho')).toBeTruthy()
    expect(screen.getByText('1,200,000')).toBeTruthy()
    // 발행 도구는 오지 않는다.
    expect(screen.queryByRole('button', { name: '발행하기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '상한 바꾸기' })).toBeNull()
  })

  it('가진 사람에게는 내 잔액과 보내기가 붙는다', async () => {
    await signInAs('@jisu')
    await openBank('금머니')

    expect(screen.getByText('내 잔액')).toBeTruthy()
    expect(screen.getByText('45,000')).toBeTruthy()
    expect(screen.getByRole('button', { name: '보내기' })).toBeTruthy()
  })

  // 여정 2 — 「묻지 않으면서 정해진다」. 카드를 누르는 것은 여전히 보내기다.
  it('카드를 누르면 은행 페이지가 아니라 보내기로 간다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await screen.findByText('금머니')
    await user.click(cardOf('금머니'))

    expect(await screen.findByText('누구에게 보낼까요?')).toBeTruthy()
  })
})

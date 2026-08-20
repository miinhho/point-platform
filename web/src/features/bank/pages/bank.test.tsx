// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
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
    // 상한 바꾸기는 발행의 조건이지 나란한 기능이 아니다 — 작게 붙어 있다.
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

/*
 * 역할마다 위가 다르다 — 보유자에게 제일 큰 것은 「내 잔액」, 은행장에게는 회원과
 * 여력, 나온 사람에게는 「왜 못 쓰나」다. 하나로 합치면 셋 다 이류가 된다.
 * 근거: docs/MOTION.md 「역할마다 따로 적는다」
 */
describe('위계는 역할마다 다르다', () => {
  /** 화면에 나오는 순서. 제일 먼저 나오는 것이 주의가 처음 닿는 곳이다 */
  function orderOf(...texts: string[]): string[] {
    const found = texts
      .map((text) => ({ text, node: screen.queryAllByText(text)[0] }))
      .filter((entry) => entry.node)
    return found
      .sort((a, b) =>
        a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map((entry) => entry.text)
  }

  it('보유자에게는 내 잔액이 소개보다 먼저다', async () => {
    await signInAs('@jisu')
    await openBank('금머니')

    expect(orderOf('내 잔액', '만든 사람')).toEqual(['내 잔액', '만든 사람'])
  })

  it('은행장에게는 회원과 여력이 소개보다 먼저다', async () => {
    await openBank('동아리회비')

    expect(orderOf('회원', '남은 여력', '만든 사람')).toEqual(['회원', '남은 여력', '만든 사람'])
  })

  it('나온 사람에게는 왜 못 쓰는지가 잔액보다 먼저다', async () => {
    await signInAs('@jisoo')
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    await user.click(await screen.findByRole('button', { name: '회원 보기' }))
    await user.click(await screen.findByRole('button', { name: '나가기' }))
    await screen.findByText('이 은행의 회원이 아니에요')

    expect(orderOf('이 은행의 회원이 아니에요', '내 잔액')).toEqual([
      '이 은행의 회원이 아니에요',
      '내 잔액',
    ])
  })

  /*
   * 「회원인가」는 서버가 `membership` 으로 답한다 — 계약: docs/API.md.
   * 명부 조회의 실패에서 역산하던 자리이고, 그때는 서버가 넘어지면 회원에게
   * 「회원이 아니에요」라고 말했다. 관측: docs/FIELD.md W7
   */
  it('명부 조회가 넘어져도 회원에게 회원이 아니라고 하지 않는다', async () => {
    server.use(
      http.get('*/api/point-types/:id/members', () =>
        HttpResponse.json({ code: 'SERVER', outcome: 'none', message: '' }, { status: 500 }),
      ),
    )
    await openBank('동아리회비')

    expect(screen.queryByText('이 은행의 회원이 아니에요')).toBeNull()
    expect(screen.getByText('회원')).toBeTruthy()
  })

  // 답을 쓰려는 게 아니라 실패를 읽으려고 쏘던 요청이다. 그 자체가 냄새였다
  it('회원 여부를 알려고 명부를 쏘지 않는다', async () => {
    const asked: string[] = []
    server.events.on('request:start', ({ request }) => asked.push(new URL(request.url).pathname))

    await signInAs('@jisoo')
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    await screen.findByRole('heading', { name: '동아리회비' })
    await waitFor(() => expect(screen.getAllByRole('banner')).toHaveLength(1))

    expect(asked.filter((path) => path.endsWith('/members'))).toEqual([])
  })
})

/*
 * 소개는 발행자가 쓰는 글이다. 여기는 「공식 계정입니다」라고 적을 수 있는 자리고
 * 앱은 그것을 판정하지 않는다 — 판단 근거인 사실이 먼저 읽혀야 한다.
 * 근거: docs/JOURNEY.md 여정 10
 */
describe('발행자가 쓴 소개', () => {
  function orderOf(...texts: string[]): string[] {
    const found = texts
      .map((text) => ({ text, node: screen.queryAllByText(text)[0] }))
      .filter((entry) => entry.node)
    return found
      .sort((a, b) =>
        a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map((entry) => entry.text)
  }

  it('사실이 소개보다 먼저 읽힌다', async () => {
    await openBank('동아리회비')

    expect(await screen.findByText('월 회비로 모으는 동아리 포인트예요')).toBeTruthy()
    expect(orderOf('만든 사람', '총 유통량', '월 회비로 모으는 동아리 포인트예요')).toEqual([
      '만든 사람',
      '총 유통량',
      '월 회비로 모으는 동아리 포인트예요',
    ])
  })

  // 앱이 쓴 글처럼 보이면 안 된다. 누가 썼는지를 라벨이 말한다.
  it('누가 쓴 글인지 라벨이 말한다', async () => {
    await openBank('동아리회비')

    expect(await screen.findByText('발행자가 쓴 소개')).toBeTruthy()
  })

  it('안 적은 은행에는 그 자리가 없다', async () => {
    await openBank('금머니')

    expect(screen.queryByText('발행자가 쓴 소개')).toBeNull()
  })
})

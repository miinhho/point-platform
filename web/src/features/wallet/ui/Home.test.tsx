// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderApp, signInAs } from '@/test/render'
import { Home } from './Home'

beforeEach(async () => {
  await signInAs()
})

/** 확인 방법: docs/JOURNEY.md 여정 1 */
const SYMBOL = /^(ON|SL|GM|OP|ZZ)$/

/** 카드가 흐려졌는지. 아무 조상도 opacity 를 정하지 않으면 죽지 않은 것이다 */
function cardOpacity(name: string): string {
  let node: HTMLElement | null = screen.getByText(name)
  while (node && getComputedStyle(node).opacity === '') node = node.parentElement
  return node ? getComputedStyle(node).opacity : '1'
}

async function symbolOrder(): Promise<string[]> {
  await screen.findByText('금머니')
  return screen.getAllByText(SYMBOL).map((el) => el.textContent ?? '')
}

function walletOf(balances: unknown[]) {
  return http.get('*/api/wallet', () =>
    HttpResponse.json({ user: { id: 'u_minho', name: '장민호', handle: '@minho' }, balances }),
  )
}

const point = (id: string, name: string, symbol: string, issuerName: string, accent: string) => ({
  id,
  name,
  symbol,
  issuerId: 'u_other',
  issuerName,
  accent,
  totalIssued: 1_000,
  issueCap: 10_000,
})

describe('홈', () => {
  it('잔액이 많은 포인트가 먼저 오고 이름이 겹치는 것은 나란히 온다', async () => {
    renderApp(<Home />)
    // 온포인트 324만 · 온포인트(솔카페) 1만2천 · 금머니 62만 · 솔포인트 8만7천
    expect(await symbolOrder()).toEqual(['ON', 'OP', 'GM', 'SL'])
  })

  it('잔액 0 은 뒤로 간다', async () => {
    server.use(
      walletOf([
        { pointType: point('pt_z', '영포인트', 'ZZ', '어딘가', 'pink'), amount: 0 },
        { pointType: point('pt_g', '금머니', 'GM', '장민호', 'purple'), amount: 5 },
      ]),
    )
    renderApp(<Home />)
    expect(await symbolOrder()).toEqual(['GM', 'ZZ'])
  })

  it('잔액 0 카드는 보낼 수 없다고 말한다', async () => {
    server.use(
      walletOf([
        { pointType: point('pt_z', '금머니', 'GM', '어딘가', 'pink'), amount: 0 },
      ]),
    )
    renderApp(<Home />)
    expect(await screen.findByText('보낼 잔액이 없어요')).toBeTruthy()
    expect(cardOpacity('금머니')).toBe('0.55')
  })

  /*
   * 관측: docs/FIELD.md 「S9 포인트 만들기 QA」 7 — 방금 만든 카드가 잔액 0 이라
   * 흐려지고 그 안의 발행 진입점까지 함께 죽었다. 근거: docs/JOURNEY.md 여정 1
   */
  it('발행할 수 있으면 잔액 0 이어도 죽이지 않는다', async () => {
    server.use(
      walletOf([
        { pointType: { ...point('pt_new', '동네빵집', 'BK', '장민호', 'orange'), canIssue: true }, amount: 0 },
      ]),
    )
    renderApp(<Home />)
    await screen.findByText('동네빵집')

    expect(cardOpacity('동네빵집')).toBe('1')
    // 다음에 할 일은 받기를 기다리는 것이 아니라 발행이다.
    expect(screen.getByText('발행해서 채울 수 있어요')).toBeTruthy()
    expect(screen.queryByText('보낼 잔액이 없어요')).toBeNull()
    expect(screen.getByRole('button', { name: '발행 관리' })).toBeTruthy()
  })

  it('이름이 겹치는 포인트에만 발행자 부제가 붙는다', async () => {
    renderApp(<Home />)
    await screen.findByText('금머니')

    expect(screen.getByText('온마트 발행')).toBeTruthy()
    expect(screen.getByText('솔카페 발행')).toBeTruthy()
    // 겹치지 않는 포인트에는 붙지 않는다
    expect(screen.queryByText('장민호 발행')).toBeNull()
  })

  /*
   * 겹침은 원장의 성질이다 — 계약: docs/API.md. `@jisoo` 는 온포인트를 한쪽만 가져서
   * 클라이언트가 자기 지갑 안에서 세면 "겹치지 않는다" 가 되고, 자기가 가진 것이
   * 어느 온포인트인지 확정 화면까지 가도 알 수 없다.
   */
  it('한쪽만 가진 사람의 지갑에도 발행자 부제가 붙는다', async () => {
    await signInAs('@jisoo')
    renderApp(<Home />)

    expect(await screen.findByText('온포인트')).toBeTruthy()
    expect(screen.getAllByText('온포인트')).toHaveLength(1)
    expect(screen.getByText('온마트 발행')).toBeTruthy()
  })

  // 여정 8 — 발행자 화면의 진입점은 그 포인트 카드의 배지다.
  it('내가 발행하는 포인트에만 발행 진입점이 붙는다', async () => {
    renderApp(<Home />)
    const entries = await screen.findAllByRole('button', { name: '발행 관리' })
    expect(entries).toHaveLength(1)
  })

  // 카드는 이체로 가는 버튼이다. 이름에 다른 행동이 섞이면 스크린리더가 거짓을 읽는다.
  it('카드의 접근성 이름에 발행 관리가 섞이지 않는다', async () => {
    renderApp(<Home />)
    const card = await screen.findByRole('button', { name: /금머니/ })
    expect(card.textContent).not.toContain('발행 관리')
    expect(card.querySelector('button')).toBeNull()
  })

  it('색을 빼도 기호로 구별된다 — 카드마다 다른 기호가 있다', async () => {
    renderApp(<Home />)
    const symbols = await symbolOrder()
    expect(symbols.length).toBeGreaterThan(1)
    expect(new Set(symbols).size).toBe(symbols.length)
  })

  it('지갑이 비면 빈 문구가 나온다', async () => {
    server.use(walletOf([]))
    renderApp(<Home />)
    expect(await screen.findByText('아직 받은 포인트가 없어요')).toBeTruthy()
  })

  it('불러오지 못하면 그렇게 말한다 — 빈 화면으로 두지 않는다', async () => {
    server.use(http.get('*/api/wallet', () => HttpResponse.error()))
    renderApp(<Home />)
    expect(await screen.findByText('지갑을 불러오지 못했어요')).toBeTruthy()
  })

  // 화면을 못 보는 사용자에게는 아무 일도 일어나지 않은 것이 된다.
  it('실패는 소리로도 닿는다', async () => {
    server.use(http.get('*/api/wallet', () => HttpResponse.error()))
    renderApp(<Home />)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '지갑을 불러오지 못했어요')
  })
})

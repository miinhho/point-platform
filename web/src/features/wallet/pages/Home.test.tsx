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
const EMOJI = /^(🌊|🍵|💎|🌸|🎵|🏠|✨)$/u

/** 카드와 그 옆의 진입점은 이름이 겹친다 — 카드는 `aria-label` 이 없는 쪽이다 */
function cardOf(name: string): HTMLElement {
  return screen
    .getAllByRole('button', { name: new RegExp(name) })
    .filter((button) => !button.getAttribute('aria-label'))[0]
}

/** 카드가 흐려졌는지. 아무 조상도 opacity 를 정하지 않으면 죽지 않은 것이다 */
function cardOpacity(name: string): string {
  let node: HTMLElement | null = screen.getByText(name)
  while (node && getComputedStyle(node).opacity === '') node = node.parentElement
  return node ? getComputedStyle(node).opacity : '1'
}

async function emojiOrder(): Promise<string[]> {
  await screen.findByText('금머니')
  return screen.getAllByText(EMOJI).map((el) => el.textContent ?? '')
}

function walletOf(balances: unknown[]) {
  return http.get('*/api/wallet', () =>
    HttpResponse.json({ user: { id: 'u_minho', name: '장민호', handle: '@minho' }, balances }),
  )
}

const point = (id: string, name: string, emoji: string, issuerName: string, accent: string) => ({
  id,
  name,
  emoji,
  issuerId: 'u_other',
  issuerName,
  accent,
  totalIssued: 1_000,
  issueCap: 10_000,
})

describe('홈', () => {
  it('잔액이 많은 포인트가 먼저 오고 이름이 겹치는 것은 나란히 온다', async () => {
    renderApp(<Home />)
    // 온포인트 324만 · 금머니 62만 · 솔포인트 8만7천 · 동아리회비 5만 · 한동네 2만5천 ·
    // 온포인트(솔카페) 1만2천. 겹치는 이름은 잔액을 건너뛰고 나란히 온다.
    expect(await emojiOrder()).toEqual(['🌊', '🌸', '💎', '🍵', '🎵', '🏠'])
  })

  it('잔액 0 은 뒤로 간다', async () => {
    server.use(
      walletOf([
        { pointType: point('pt_z', '영포인트', '✨', '어딘가', 'pink'), amount: 0 },
        { pointType: point('pt_g', '금머니', '💎', '장민호', 'purple'), amount: 5 },
      ]),
    )
    renderApp(<Home />)
    expect(await emojiOrder()).toEqual(['💎', '✨'])
  })

  it('잔액 0 카드는 보낼 수 없다고 말한다', async () => {
    server.use(
      walletOf([
        { pointType: point('pt_z', '금머니', '💎', '어딘가', 'pink'), amount: 0 },
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
        { pointType: { ...point('pt_new', '동네빵집', '🍞', '장민호', 'orange'), canIssue: true }, amount: 0 },
      ]),
    )
    renderApp(<Home />)
    await screen.findByText('동네빵집')

    expect(cardOpacity('동네빵집')).toBe('1')
    // 다음에 할 일은 받기를 기다리는 것이 아니라 발행이다.
    expect(screen.getByText('발행해서 채울 수 있어요')).toBeTruthy()
    expect(screen.queryByText('보낼 잔액이 없어요')).toBeNull()
    expect(screen.getByRole('button', { name: '동네빵집 자세히' })).toBeTruthy()
  })

  /*
   * 셋을 따로따로는 이미 재고 있었다. 따로 재면 각자 자기 문구를 말하는 것만 알 수 있고
   * **서로 다르게 말하는지**는 모른다 — 그것이 이 앱이 여정 1 에서 가르려던 것이다.
   * 실서버 시드의 모양 그대로다(`@jisoo` 발행자 0 · `@jisu` 회원 0 · `@mose` 나간 뒤 잔액).
   */
  it('0 이 셋이고 한 화면에서 서로 다르게 말한다', async () => {
    server.use(
      walletOf([
        { pointType: { ...point('pt_mine', '동네빵집', '🍞', '장민호', 'orange'), canIssue: true }, amount: 0 },
        { pointType: { ...point('pt_new', '동아리비', '🎪', '온마트', 'purple'), visibility: 'private', membership: 'member' }, amount: 0 },
        { pointType: point('pt_spent', '금머니', '💎', '온마트', 'pink'), amount: 0 },
      ]),
    )
    renderApp(<Home />)
    await screen.findByText('동아리비')

    expect(screen.getByText('발행해서 채울 수 있어요')).toBeTruthy()
    expect(screen.getByText('들어왔어요. 아직 받은 것이 없어요')).toBeTruthy()
    expect(screen.getByText('보낼 잔액이 없어요')).toBeTruthy()
  })

  /*
   * 값이 같으니 **문구만이 가른다.** 그런데 흐림은 문구보다 먼저 눈에 닿는다 —
   * 흐려진 것을 읽을 이유가 없다고 판단한 뒤에 문구를 안 읽는다. 다음에 할 일이
   * 있는 둘은 흐리지 않는다. 근거: docs/MOTION.md Attention
   */
  it('할 일이 남은 0 은 흐려지지 않는다', async () => {
    server.use(
      walletOf([
        { pointType: { ...point('pt_mine', '동네빵집', '🍞', '장민호', 'orange'), canIssue: true }, amount: 0 },
        { pointType: { ...point('pt_new', '동아리비', '🎪', '온마트', 'purple'), visibility: 'private', membership: 'member' }, amount: 0 },
        { pointType: point('pt_spent', '금머니', '💎', '온마트', 'pink'), amount: 0 },
      ]),
    )
    renderApp(<Home />)
    await screen.findByText('동아리비')

    expect(cardOpacity('동네빵집')).toBe('1')
    expect(cardOpacity('동아리비')).toBe('1')
    expect(cardOpacity('금머니')).toBe('0.55')
  })

  /*
   * 넷째는 0 이 아니다. **가진 것이 보이는데 보낼 수 없는 것**이라 값을 읽고
   * 누르러 가는 사람에게만 걸린다 — 관측: docs/FIELD.md, 실서버 `@mose`.
   */
  it('가진 것이 있는데 못 쓰는 카드는 0 셋 중 어느 것과도 다르게 말한다', async () => {
    server.use(
      walletOf([
        { pointType: { ...point('pt_left', '동아리비', '🎪', '온마트', 'purple'), visibility: 'private', membership: 'outsider' }, amount: 30_000, sendable: 0 },
        { pointType: { ...point('pt_new', '동아리비', '🎪', '온마트', 'purple'), visibility: 'private', membership: 'member' }, amount: 0 },
      ]),
    )
    renderApp(<Home />)
    await screen.findByText('30,000')

    expect(screen.getByText('지금은 보낼 수 없어요')).toBeTruthy()
    expect(screen.getByText('들어왔어요. 아직 받은 것이 없어요')).toBeTruthy()
    expect(screen.queryByText('보낼 잔액이 없어요')).toBeNull()
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

  /*
   * 나간 은행의 잔액은 지우지도 옮기지도 않고 그대로 남는다. 조용히 두면 사용자는
   * 보낼 수 있다고 믿는다. 계약: docs/API.md 「회원 자격」
   */
  it('쓸 수 없는 잔액은 그렇게 말하고 누를 수 없다', async () => {
    server.use(
      walletOf([
        {
          pointType: point('pt_hd', '한동네', '🏠', '솔카페', 'orange'),
          amount: 25_000,
          sendable: 0,
        },
      ]),
    )
    renderApp(<Home />)
    await screen.findByText('한동네')

    expect(screen.getByText('지금은 보낼 수 없어요')).toBeTruthy()
    // 잔액은 그대로 보인다 — 사라진 것이 아니라 쓸 수 없는 것이다.
    expect(screen.getByText('25,000')).toBeTruthy()
    expect(cardOf('한동네')).toBeUndefined()
  })

  /*
   * 「봤어요」 버튼을 두지 않는다 — 눌러서 지우는 표시는 읽지 않고 눌린다.
   * 표시가 남아 있는 것은 거짓이 아니라 아직 판단하지 않았다는 뜻이다. 여정 10
   */
  it('아직 써 보지 않은 포인트를 그렇게 말한다', async () => {
    renderApp(<Home />)
    await screen.findByText('금머니')

    // 시드에서 온포인트(솔카페)만 받기만 하고 써 본 적이 없다.
    expect(screen.getByText('아직 써 보지 않은 포인트예요')).toBeTruthy()
    expect(screen.getAllByText('아직 써 보지 않은 포인트예요')).toHaveLength(1)
  })

  // 내가 만든 은행은 낯설지 않다. 판단할 것이 없는 자리에 표시를 남기면 소음이다.
  it('내가 발행하는 포인트에는 붙지 않는다', async () => {
    server.use(
      walletOf([
        {
          pointType: { ...point('pt_new', '동네빵집', '🍞', '장민호', 'orange'), canIssue: true },
          amount: 500,
          neverSpent: true,
        },
      ]),
    )
    renderApp(<Home />)
    await screen.findByText('동네빵집')

    expect(screen.queryByText('아직 써 보지 않은 포인트예요')).toBeNull()
  })

  // 판단할 것은 발행자에게만 있는 것이 아니다 — docs/JOURNEY.md 여정 10
  it('발행자가 아닌 포인트에도 은행 페이지 진입점이 붙는다', async () => {
    renderApp(<Home />)
    await screen.findByText('금머니')
    // 시드의 여섯 카드 전부.
    expect(screen.getAllByRole('button', { name: /자세히$/ })).toHaveLength(6)
  })

  // 카드는 이체로 가는 버튼이다. 이름에 다른 행동이 섞이면 스크린리더가 거짓을 읽는다.
  it('카드의 접근성 이름에 진입점 글자가 섞이지 않는다', async () => {
    renderApp(<Home />)
    await screen.findByText('금머니')
    const card = cardOf('금머니')
    expect(card.textContent).not.toContain('자세히')
    expect(card.querySelector('button')).toBeNull()
  })

  // 이모지는 모양으로 갈리므로 색을 빼도 갈린다 — 겹쳐도 되는 것과는 다른 이야기다.
  it('색을 빼도 표식으로 구별된다', async () => {
    renderApp(<Home />)
    const emoji = await emojiOrder()
    expect(emoji.length).toBeGreaterThan(1)
    expect(new Set(emoji).size).toBe(emoji.length)
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
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('지갑을 불러오지 못했어요')
    // 조회는 돈을 움직이지 않는다. 그것도 함께 말한다.
    expect(alert.textContent).toContain('아무것도 바뀌지 않았어요')
  })

  // 빈 목록과 실패가 같은 화면이면 여정 1 이 가르려던 것이 무너진다.
  it('실패는 「아직 없어요」와 다른 화면이다', async () => {
    server.use(http.get('*/api/wallet', () => HttpResponse.error()))
    renderApp(<Home />)
    await screen.findByRole('alert')

    expect(screen.queryByText('아직 받은 포인트가 없어요')).toBeNull()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })
})

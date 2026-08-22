// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { issuesApi, newIdempotencyKey, transfersApi, walletApi } from '@/shared/api'
import { balanceOf, SEED_ISSUER } from '@/mocks/ledger'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

beforeEach(async () => {
  await signInAs()
})

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
    expect(await screen.findByText('아직 오간 것이 없어요')).toBeTruthy()
  })

  it('보낸 것이 보이고 상세로 들어간다', async () => {
    await transfersApi.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 },
      newIdempotencyKey(),
    )
    const user = await openHistory()

    const row = await screen.findByRole('button', { name: /30,000/ })
    await user.click(row)
    expect(await screen.findByText('이체 내역')).toBeTruthy()
    // 받는 사람은 서버가 실어 준다 — 목록에서 맞추면 목록에 없는 순간 조용히 틀린다.
    expect(screen.getAllByText('김지수에게').length).toBeGreaterThan(0)
    /*
     * 요청 키를 내보내지 않는다. 요청자별로만 뜻이 있어서 남에게 말해도 아무도
     * 못 찾고, 두 번 보내지지 않았다는 것은 줄이 하나인 것으로 보여야 한다.
     */
    expect(screen.queryByText('요청 키')).toBeNull()
    expect(document.body.textContent).not.toContain('k_')
  })

  /*
   * 같은 30,000 이 오갔을 때 두 사람의 화면에 남는 것은 상대 이름과 금액인데, 그 둘이
   * 서로 같다. **방향을 말하지 않으면 두 줄이 글자 그대로 같아진다.**
   *
   * 방향은 색이 아니라 글자다 — 색만으로 가르면 색맹·저조도에서 사라지고, 화살표를
   * 쓰려면 아이콘이 필요한데 이 앱의 이모지는 은행 표식이라 뜻이 겹친다.
   */
  it('보낸 쪽과 받은 쪽의 목록 줄이 다르다', async () => {
    await transfersApi.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 },
      newIdempotencyKey(),
    )
    await openHistory()
    expect(await screen.findByText('김지수에게')).toBeTruthy()

    // 앞 화면이 함께 떠 있어 이름이 겹친다. 새로 그린 쪽만 본다.
    await signInAs('@jisoo')
    const received = within(renderApp(<App />).container)
    expect(await received.findByText('장민호에게서', {}, { timeout: 5000 })).toBeTruthy()
    expect(received.queryByText('김지수에게')).toBeNull()
  })

  // 받은 이체에 「보낸 시각」이 붙으면 내가 보낸 것으로 읽힌다.
  it('상세의 시각 라벨도 방향을 따른다', async () => {
    const user = await openHistory()
    await transfersApi.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 7_000 },
      newIdempotencyKey(),
    )

    await signInAs('@jisoo')
    const received = within(renderApp(<App />).container)
    await user.click(await received.findByRole('button', { name: /7,000/ }, { timeout: 5000 }))
    expect(await received.findByText('받은 시각')).toBeTruthy()
    expect(received.queryByText('보낸 시각')).toBeNull()
  })

  // 되돌리는 버튼이 있으면 앱 전체가 "사실 되돌릴 수 있다" 는 전제 위에 선다.
  it('상세에 되돌리는 경로가 없다', async () => {
    await transfersApi.createTransfer(
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

  /*
   * 발행에는 상대가 없다. 이체 상세의 「누구에게」·「보낸 사람」 칸을 빌려 쓰면 빈 칸을
   * 채우려고 「나」와 「무에서」가 나온다 — 화면이 뜻 없는 말을 하게 된다.
   */
  it('발행 목록 줄에 사람이 없다', async () => {
    await issuesApi.createIssue({ pointTypeId: 'pt_gm', amount: 5_000 }, newIdempotencyKey())
    await openHistory()

    expect(await screen.findByText('금머니 발행')).toBeTruthy()
    expect(screen.queryByText('나')).toBeNull()
  })

  /*
   * 일어난 일은 일어난 때의 값을 갖는다. 지금 `PointType` 에서 읽으면 지난주 발행의
   * 상세에 오늘 유통량이 뜬다. 계약: docs/API.md 「발행은 이체가 아니다」
   */
  it('발행 상세는 그때의 유통량과 상한을 말한다 — 상대도 띠도 없다', async () => {
    await issuesApi.createIssue({ pointTypeId: 'pt_gm', amount: 5_000 }, newIdempotencyKey())
    const user = await openHistory()
    await user.click(await screen.findByRole('button', { name: /5,000/ }))
    await screen.findByText('발행 내역')

    expect(screen.getByText('발행 뒤 총 유통량')).toBeTruthy()
    expect(screen.getByText('그때의 발행 상한')).toBeTruthy()
    expect(screen.getByText('1,205,000')).toBeTruthy()
    // 색 띠가 화면 맨 위 주의를 먹지 않는다.
    expect(document.body.textContent).not.toContain('무에서')
  })

  /*
   * `404` 는 답이지 실패가 아니다. 답인 것에 「다시 시도」를 주면 영원히 같은 답을 받는다.
   *
   * 서버가 발행 단건에 제 코드를 주지 않고 이체의 것을 빌리면 이 자리가 이체 이야기를
   * 한다 — 화면이 코드로 갈리기 때문이다. 계약: docs/API.md 「발행도 같다」
   */
  it('없는 발행은 답이라고 말하고, 이체 이야기를 하지 않는다', async () => {
    renderApp(<App />)
    await screen.findByText('내 포인트')
    history.pushState(null, '', '/history/issues/is_nope')
    dispatchEvent(new PopStateEvent('popstate'))

    expect(await screen.findByText('이 기록은 볼 수 없어요')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(document.body.textContent).not.toContain('이체')
  })

  // 그 뒤에 더 발행해도 앞의 상세는 그대로다.
  it('나중 발행이 앞 발행의 상세를 바꾸지 않는다', async () => {
    await issuesApi.createIssue({ pointTypeId: 'pt_gm', amount: 5_000 }, newIdempotencyKey())
    await issuesApi.createIssue({ pointTypeId: 'pt_gm', amount: 7_000 }, newIdempotencyKey())
    const user = await openHistory()

    await user.click(await screen.findByRole('button', { name: /5,000/ }))
    await screen.findByText('발행 내역')
    expect(screen.getByText('1,205,000')).toBeTruthy()
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

/*
 * 지갑과 내역은 모수가 다르다 — 지갑은 관계로 거르고 내역은 관여 여부로 거른다.
 * 공개 은행에는 회원 개념이 없어 전액을 보내면 남는 관계가 없다. 그 순간 지갑에서
 * 빠지고 방금 만든 이체 줄만 내역에 남는다. 클라이언트가 지갑에서 이름을 찾으면 그 줄이 빈 칸이 되고
 * 색은 기본값으로 떨어지는데, 그 기본값도 누군가의 진짜 색이다.
 * 계약: docs/API.md
 */
/*
 * 내역 줄은 어느 은행인지를 **스스로** 말해야 한다. 지갑에서 `pointTypeId` 로 찾아 이름을
 * 맞추면 지갑에 없는 순간 줄이 빈다.
 *
 * 전에는 「전액을 보내면 지갑에서 빠진다」가 그 순간을 만들어 줬는데, 지갑이 「가졌던 0」을
 * 담기 시작하면서 그 경우가 사라졌다 — 보낸 적이 있으면 받은 적도 있어서 카드가 남는다.
 * 그래서 지갑을 직접 비워 놓고 잰다. 사라진 것은 예시이지 규칙이 아니다.
 */
describe('내역 줄은 지갑을 뒤지지 않고 스스로 은행을 말한다', () => {
  it('지갑이 비어서 와도 이름이 남는다', async () => {
    const before = balanceOf('pt_on2', SEED_ISSUER)
    await transfersApi.createTransfer(
      { pointTypeId: 'pt_on2', toId: 'u_jisoo', amount: before },
      newIdempotencyKey(),
    )

    // 전액을 보내도 카드는 「가졌던 0」으로 남는다 — 그것이 지금의 계약이다.
    const wallet = await walletApi.wallet()
    expect(wallet.balances.find((b) => b.pointType.id === 'pt_on2')).toMatchObject({ amount: 0 })

    const me = wallet.user
    server.use(http.get('*/api/wallet', () => HttpResponse.json({ user: me, balances: [] })))
    await openHistory()

    expect(await screen.findByText(/온포인트/)).toBeTruthy()
  })

  /*
   * 목록만 고치면 한 화면에서 확인한 것이 다음 화면에서 부정된다 — 내역에서
   * 「온포인트」라고 읽고 눌렀는데 상세에는 이름이 없고 화면이 기본색이 된다.
   * 되돌릴 수 없는 이체를 확인하러 들어간 자리다. 계약: docs/API.md
   */
  it('상세에서도 이름이 남는다', async () => {
    const before = balanceOf('pt_on2', SEED_ISSUER)
    await transfersApi.createTransfer(
      { pointTypeId: 'pt_on2', toId: 'u_jisoo', amount: before },
      newIdempotencyKey(),
    )

    const user = await openHistory()
    await user.click(await screen.findByRole('button', { name: /12,000/ }))
    await screen.findByText('이체 내역')
    // 전환 중에는 목록이 함께 떠 있다. 그쪽 이름이 상세의 것으로 읽히면 안 된다.
    await settle()

    expect(screen.getByText('온포인트')).toBeTruthy()
  })
})

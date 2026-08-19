// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { endpoints } from '@/api/endpoints'
import { newIdempotencyKey } from '@/api/http'
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
    // 받는 사람은 서버가 실어 준다 — 목록에서 맞추면 목록에 없는 순간 조용히 틀린다.
    expect(screen.getAllByText('김지수').length).toBeGreaterThan(0)
    /*
     * 요청 키를 내보내지 않는다. 요청자별로만 뜻이 있어서 남에게 말해도 아무도
     * 못 찾고, 두 번 보내지지 않았다는 것은 줄이 하나인 것으로 보여야 한다.
     */
    expect(screen.queryByText('요청 키')).toBeNull()
    expect(document.body.textContent).not.toContain('k_')
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

  /*
   * 발행에는 상대가 없다. 이체 상세의 「누구에게」·「보낸 사람」 칸을 빌려 쓰면 빈 칸을
   * 채우려고 「나」와 「무에서」가 나온다 — 화면이 뜻 없는 말을 하게 된다.
   */
  it('발행 목록 줄에 사람이 없다', async () => {
    await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 5_000 }, newIdempotencyKey())
    await openHistory()

    expect(await screen.findByText('금머니 발행')).toBeTruthy()
    expect(screen.queryByText('나')).toBeNull()
  })

  /*
   * 일어난 일은 일어난 때의 값을 갖는다. 지금 `PointType` 에서 읽으면 지난주 발행의
   * 상세에 오늘 유통량이 뜬다. 계약: docs/API.md 「발행은 이체가 아니다」
   */
  it('발행 상세는 그때의 유통량과 상한을 말한다 — 상대도 띠도 없다', async () => {
    await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 5_000 }, newIdempotencyKey())
    const user = await openHistory()
    await user.click(await screen.findByRole('button', { name: /5,000/ }))
    await screen.findByText('발행 내역')

    expect(screen.getByText('발행 뒤 총 유통량')).toBeTruthy()
    expect(screen.getByText('그때의 발행 상한')).toBeTruthy()
    expect(screen.getByText('1,205,000')).toBeTruthy()
    // 색 띠가 화면 맨 위 주의를 먹지 않는다.
    expect(document.body.textContent).not.toContain('무에서')
  })

  // 그 뒤에 더 발행해도 앞의 상세는 그대로다.
  it('나중 발행이 앞 발행의 상세를 바꾸지 않는다', async () => {
    await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 5_000 }, newIdempotencyKey())
    await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 7_000 }, newIdempotencyKey())
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

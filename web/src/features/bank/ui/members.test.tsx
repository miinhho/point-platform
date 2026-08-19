// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/API.md 「회원 자격」 · docs/JOURNEY.md 여정 10 */

beforeEach(async () => {
  await signInAs()
})

async function openMembers(bank: string, handle?: string) {
  if (handle) await signInAs(handle)
  const user = userEvent.setup()
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: `${bank} 자세히` }))
  await user.click(await screen.findByRole('button', { name: '회원 보기' }))
  await screen.findByRole('heading', { name: '회원' })
  return user
}

describe('회원 목록', () => {
  it('회원과 은행장이 갈린다', async () => {
    await openMembers('동아리회비')

    expect(await screen.findByText('@jisoo')).toBeTruthy()
    expect(screen.getByText('은행장')).toBeTruthy()
  })

  // 목록 길이로 세지 않는다 — 목록은 잘려 올 수 있고 그러면 수가 조용히 틀린다.
  it('회원 수는 서버가 준 값으로 소개에 나온다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    await screen.findByRole('heading', { name: '동아리회비' })

    expect(await screen.findByText('2명')).toBeTruthy()
  })

  // 공개 은행에는 회원 개념이 없다. 0 명이 아니라 아예 없다.
  it('공개 은행에는 회원 수 줄이 없다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '금머니 자세히' }))
    await screen.findByRole('heading', { name: '금머니' })

    expect(screen.queryByText(/^\d+명$/)).toBeNull()
  })

  // 공개 은행에는 회원 개념이 아예 없다.
  it('공개 은행에는 회원 보기가 없다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '금머니 자세히' }))
    await screen.findByRole('heading', { name: '금머니' })

    expect(screen.queryByRole('button', { name: '회원 보기' })).toBeNull()
  })
})

describe('내보낸다', () => {
  it('은행장은 회원을 내보낸다', async () => {
    const user = await openMembers('동아리회비')
    await screen.findByText('@jisoo')
    await user.click(screen.getByRole('button', { name: '내보내기' }))

    await waitFor(() => expect(screen.queryByText('@jisoo')).toBeNull())
  })

  // 발행할 사람이 없는 은행이 된다. 누를 수 없는 버튼이 아니라 버튼이 없어야 한다.
  it('은행장 줄에는 내보내기가 없다', async () => {
    await openMembers('동아리회비')
    await screen.findByText('@jisoo')

    // 회원 둘 중 내보낼 수 있는 것은 하나뿐이다.
    expect(screen.getAllByRole('button', { name: '내보내기' })).toHaveLength(1)
  })

  it('은행장이 아니면 내보내기가 아예 없다', async () => {
    await openMembers('한동네', '@minho')
    await screen.findByText('@solcafe')

    expect(screen.queryByRole('button', { name: '내보내기' })).toBeNull()
  })
})

describe('나간다', () => {
  it('은행장에게는 나가기 버튼이 없다', async () => {
    await openMembers('동아리회비')
    expect(screen.queryByRole('button', { name: '나가기' })).toBeNull()
  })

  // 「간 건 간 거다」 — 잔액을 지우거나 옮기지 않는다.
  it('나가도 잔액은 남지만 쓸 수 없다고 미리 말한다', async () => {
    await openMembers('한동네', '@minho')
    expect(screen.getByText('나가도 잔액은 그대로 남지만 쓸 수 없어요')).toBeTruthy()
  })

  /*
   * 나온 사람에게 이 페이지는 「물으러 갈 곳」이다. 홈으로 돌려보내면 왜 못 쓰는지가
   * 적힐 자리가 없어진다. 계약: docs/API.md 「회원 자격」
   */
  it('나가도 은행 페이지에 남고, 그 페이지가 왜 못 쓰는지 말한다', async () => {
    const user = await openMembers('한동네', '@minho')
    await user.click(screen.getByRole('button', { name: '나가기' }))

    await screen.findByRole('heading', { name: '한동네' })
    expect(await screen.findByText('이 은행의 회원이 아니에요')).toBeTruthy()
    expect(screen.getByText('그래서 이 잔액을 지금 보낼 수 없어요')).toBeTruthy()
    // 겁주지 않는다 — 잃은 것이 아니다.
    expect(screen.getByText('없어진 것은 아니에요. 다시 초대받으면 그대로 써요')).toBeTruthy()
  })

  it('나온 뒤에는 보내기도 명부도 오지 않는다', async () => {
    const user = await openMembers('한동네', '@minho')
    await user.click(screen.getByRole('button', { name: '나가기' }))
    await screen.findByText('이 은행의 회원이 아니에요')

    expect(screen.queryByRole('button', { name: '보내기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '회원 보기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '초대하기' })).toBeNull()
  })

  // 보이는 것은 은행의 공개 사실뿐이다.
  it('나온 뒤에도 소개는 그대로 보인다', async () => {
    const user = await openMembers('한동네', '@minho')
    await user.click(screen.getByRole('button', { name: '나가기' }))
    await screen.findByText('이 은행의 회원이 아니에요')

    // 전환 중에는 떠나는 명부 화면이 함께 떠 있다 — 같은 글자가 둘일 수 있다.
    expect(screen.getAllByText('@solcafe').length).toBeGreaterThan(0)
    expect(screen.getAllByText('900,000').length).toBeGreaterThan(0)
    // 잔액은 사라진 것이 아니라 쓸 수 없는 것이다.
    expect(screen.getAllByText('25,000').length).toBeGreaterThan(0)
  })
})

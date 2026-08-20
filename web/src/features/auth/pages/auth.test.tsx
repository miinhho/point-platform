// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { setTokens } from '@/shared/api'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: 로그인하지 않으면 어떤 잔액도 보이지 않는다 */
async function signInWith(handle: string, password: string) {
  const user = userEvent.setup()
  renderApp(<App />)
  await user.type(await screen.findByLabelText('핸들'), handle)
  await user.type(screen.getByLabelText('암호'), password)
  await user.click(screen.getByRole('button', { name: '들어가기' }))
  return user
}

describe('로그인', () => {
  /*
   * 주소가 진실이다 — 계약: docs/REBUILD.md 「주소」. 토큰은 메모리에만 있으므로
   * 새로고침하면 반드시 로그인 화면을 지난다. 그때 주소를 잃으면 **공유 링크로
   * 들어온 사람은 로그인 뒤 홈에 떨어지고 자기가 무엇을 열려 했는지 모른다.**
   * 관측: docs/FIELD.md W11
   */
  it('주소로 들어온 화면이 로그인 뒤에도 남는다', async () => {
    history.replaceState(null, '', '/points/pt_cl')
    await signInWith('@minho', 'point')

    expect(await screen.findByRole('heading', { name: '동아리회비' })).toBeTruthy()
    expect(location.pathname).toBe('/points/pt_cl')
  })

  it('로그인하지 않으면 잔액이 보이지 않는다', async () => {
    renderApp(<App />)
    expect(await screen.findByRole('button', { name: '들어가기' })).toBeTruthy()
    expect(screen.queryByText('3,240,000')).toBeNull()
    expect(screen.queryByText('내 포인트')).toBeNull()
  })

  it('핸들과 암호가 맞으면 들어간다', async () => {
    await signInWith('@minho', 'point')
    expect(await screen.findByText('내 포인트')).toBeTruthy()
    expect(await screen.findByText('3,240,000')).toBeTruthy()
  })

  it('@ 를 빠뜨려도 들어간다 — 형식은 서버가 흡수한다', async () => {
    await signInWith('minho', 'point')
    expect(await screen.findByText('내 포인트')).toBeTruthy()
  })

  it('암호 관리자가 채울 수 있게 이름을 밝힌다', async () => {
    renderApp(<App />)
    expect(await screen.findByLabelText('핸들')).toHaveProperty('autocomplete', 'username')
    expect(screen.getByLabelText('암호')).toHaveProperty('autocomplete', 'current-password')
  })

  it('암호가 틀리면 그렇게 말하고 들어가지 않는다', async () => {
    await signInWith('@minho', 'wrong')
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '핸들이나 암호가 맞지 않아요',
    )
    expect(screen.queryByText('내 포인트')).toBeNull()
  })

  it('없는 핸들도 같은 문구다 — 어느 핸들이 있는지 알려주지 않는다', async () => {
    await signInWith('@nobody', 'point')
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '핸들이나 암호가 맞지 않아요',
    )
  })

  it('다른 사용자로 로그인하면 그 사람의 지갑이 나온다', async () => {
    await signInWith('@jisoo', 'point')
    expect(await screen.findByText('내 포인트')).toBeTruthy()
    // 김지수는 온포인트 812,000 만 가진다. 장민호의 잔액이 보이면 안 된다
    expect(await screen.findByText('812,000')).toBeTruthy()
    expect(screen.queryByText('3,240,000')).toBeNull()
  })
})

describe('토큰이 죽으면', () => {
  it('로그인 화면으로 돌아간다', async () => {
    const user = userEvent.setup()
    await signInAs()
    renderApp(<App />)
    await screen.findByText('내 포인트')

    // 토큰이 죽은 뒤 어떤 요청이든 401 을 받으면 로그인으로 간다.
    // 세션 조회가 캐시돼 있으므로 다른 요청이 401 을 물어 와야 한다.
    setTokens({ accessToken: 'dead', refreshToken: 'dead' })
    await user.click(screen.getByRole('button', { name: '내역' }))
    await waitFor(() => expect(screen.queryByText('내 포인트')).toBeNull(), { timeout: 10_000 })

    expect(await screen.findByRole('button', { name: '들어가기' })).toBeTruthy()
  })
})

describe('로그아웃', () => {
  it('설정에서 나가면 잔액이 사라진다', async () => {
    const user = userEvent.setup()
    await signInAs()
    renderApp(<App />)
    await screen.findByText('내 포인트')

    await user.click(screen.getByRole('button', { name: '설정' }))
    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('button', { name: '들어가기' })).toBeTruthy()
    expect(screen.queryByText('3,240,000')).toBeNull()
  })

  it('다음 사람은 앞사람이 보던 탭이 아니라 홈에서 시작한다', async () => {
    const user = userEvent.setup()
    await signInAs()
    renderApp(<App />)
    await screen.findByText('내 포인트')

    await user.click(screen.getByRole('button', { name: '설정' }))
    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    await user.type(await screen.findByLabelText('핸들'), '@jisoo')
    await user.type(screen.getByLabelText('암호'), 'point')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    expect(await screen.findByText('내 포인트')).toBeTruthy()
    expect(screen.queryByText('내 계정')).toBeNull()
  })

  /*
   * 탭만이 아니라 **주소도** 앞사람의 것을 물려주지 않는다. 주소가 화면을 정하므로
   * 그것이 남으면 다음 사람이 앞사람이 보던 은행에서 시작한다.
   */
  it('다음 사람은 앞사람이 들어간 주소를 물려받지 않는다', async () => {
    const user = userEvent.setup()
    await signInAs()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '동아리회비 자세히' }))
    await waitFor(() => expect(location.pathname).toBe('/points/pt_cl'))

    await user.click(await screen.findByRole('button', { name: '홈' }))
    await user.click(screen.getByRole('button', { name: '설정' }))
    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    await user.type(await screen.findByLabelText('핸들'), '@jisoo')
    await user.type(screen.getByLabelText('암호'), 'point')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await screen.findByText('내 포인트')
    expect(location.pathname).toBe('/')
  })
})

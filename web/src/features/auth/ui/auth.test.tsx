// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { setTokens } from '@/api/http'
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
})

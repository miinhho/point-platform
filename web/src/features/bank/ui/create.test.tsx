// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { endpoints } from '@/api/endpoints'
import { setSim } from '@/mocks/sim'
import { renderApp, signInAs } from '@/test/render'
import App from '@/app/App'

/** 확인 방법: docs/JOURNEY.md 여정 9 */

beforeEach(async () => {
  await signInAs()
})

/** 홀드를 ms 만큼 누른다. 600ms 를 넘겨야 발동한다 */
async function hold(ms: number) {
  const button = screen.getByRole('button', { name: '꾹 눌러서 만들기' })
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, ms))
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  emoji = '🍞',
  visibility = '공개',
) {
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
  await user.type(await screen.findByLabelText('이름'), '동네빵집')
  await user.type(screen.getByLabelText('발행 상한'), '1000000')
  await user.click(screen.getByRole('radio', { name: emoji }))
  // 골라 둔 쪽이 없다. 고르지 않으면 확정할 수 없다.
  await user.click(screen.getByRole('radio', { name: new RegExp(`^${visibility}`) }))
}

describe('포인트를 만든다', () => {
  it('만든 즉시 홈 목록에 그 카드가 있다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await hold(750)

    expect(await screen.findByText('만들었어요', {}, { timeout: 5000 })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '홈으로' }))

    expect(await screen.findByText('동네빵집', {}, { timeout: 5000 })).toBeTruthy()
    // 잔액 0 이라도 은행 페이지로 갈 수 있다. 없으면 발행하러 갈 길이 없다.
    await user.click(await screen.findByRole('button', { name: '동네빵집 자세히' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '발행하기' })).toBeTruthy())
  })

  /*
   * 유일성을 버렸다. 쓸 만한 이모지는 몇백 개뿐이라 유일하게 두면 먼저 만든 사람이
   * 차지하는 경주가 된다 — 빵집 백 번째는 빵을 못 쓴다. 계약: docs/API.md
   */
  it('이미 쓰는 표식으로도 만들어진다', async () => {
    const user = userEvent.setup()
    // 시드의 온포인트가 이미 🌊 를 쓴다.
    await fillForm(user, '🌊')
    await hold(750)

    expect(await screen.findByText('만들었어요', {}, { timeout: 5000 })).toBeTruthy()
  })

  it('확정 전에 카드 모습을 보여준다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    const preview = screen.getByText('이렇게 보여요').parentElement!
    expect(preview.textContent).toContain('동네빵집')
    expect(preview.textContent).toContain('🍞')
  })

  it('짧게 누르면 만들어지지 않는다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await hold(200)
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.getByText('포인트 만들기')).toBeTruthy()
  })

  it('빈 폼으로는 확정할 수 없다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    expect(screen.getByRole('button', { name: '꾹 눌러서 만들기' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('고른 표식이 그대로 미리보기에 온다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    await user.click(screen.getByRole('radio', { name: '🍞' }))
    expect((screen.getByRole('radio', { name: '🍞' }) as HTMLInputElement).checked).toBe(true)
  })

  it('만든 것을 지우는 경로가 없다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await hold(750)
    await screen.findByText('만들었어요', {}, { timeout: 5000 })

    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(labels.filter((label) => /지우|삭제|없애/.test(label))).toEqual([])
  })
})

/*
 * 관측: docs/FIELD.md 「S9 포인트 만들기 QA」 2 — `role="radio"` 만 붙인 버튼 여섯은
 * 방향키로 순회되지 않고 여섯 전부가 탭 정지점이었다.
 */
describe('색 고르기는 진짜 라디오그룹이다', () => {
  async function openForm() {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    await screen.findByLabelText('이름')
    return user
  }

  const accentRadios = () =>
    within(screen.getByRole('radiogroup', { name: '색' })).getAllByRole(
      'radio',
    ) as HTMLInputElement[]

  // 방향키 순회는 같은 name 을 공유하는 네이티브 라디오가 브라우저에서 주는 것이다.
  it('열이 한 그룹을 이룬다', async () => {
    await openForm()
    const radios = accentRadios()
    expect(radios).toHaveLength(10)
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1)
    expect(radios[0].name).not.toBe('')
  })

  /*
   * 선택된 것만 칠하면 눌러 봐야 무슨 색인지 안다 — 색을 고르는 자리에서 색이 안
   * 보이는 것이다. 사용자 지적: 「포인트 자세히 UX 가 최악이다」.
   *
   * 칠은 이제 선택과 무관한 한 줄이라 여기서 잴 것이 없다. 남은 것은 선택이 색이
   * 아닌 다른 채널로 말하는가이고, 실제로 칠해져 보이는지는 눈이 판정한다.
   */
  it('선택은 색이 아니라 체크가 말한다', async () => {
    await openForm()

    expect(accentRadios()).toHaveLength(10)
    expect(screen.getAllByText('✓')).toHaveLength(1)
  })

  it('탭 정지점은 그룹당 하나다 — 열 번 눌러야 상한에 닿지 않는다', async () => {
    const user = await openForm()
    screen.getByLabelText('이름').focus()

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '🍞' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '파랑' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('소개'))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /^공개/ }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('발행 상한'))
  })

  it('선택된 색만 체크된다 — 색을 빼도 갈린다', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('radio', { name: '보라' }))

    const checked = screen.getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)
    expect(checked).toHaveLength(1)
    expect(checked[0]).toHaveProperty('value', 'purple')
  })
})

// 관측: docs/FIELD.md 「S9 포인트 만들기 QA」 5 — 실패 뒤 포커스가 body 로 빠졌다.
describe('만들지 못해도 입력을 버리지 않는다', () => {
  it('네트워크 실패 뒤에도 이름·표식·상한이 그대로다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    setSim({ forceFailure: 'NETWORK' })
    await hold(750)

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveProperty(
      'textContent',
      '서버에 닿지 못했어요',
    )
    expect(screen.getByLabelText('이름')).toHaveProperty('value', '동네빵집')
    expect((screen.getByRole('radio', { name: '🍞' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByLabelText('발행 상한')).toHaveProperty('value', '1,000,000')
  })

  // 결과를 알 수 없는 실패다. 키 입력 하나로 지우면 "만들어졌는지 모른다"가 사라진다.
  it('표식을 바꿔도 결과를 알 수 없다는 말은 남는다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    setSim({ forceFailure: 'NETWORK' })
    await hold(750)
    await screen.findByRole('alert', {}, { timeout: 5000 })

    await user.click(screen.getByRole('radio', { name: '🍎' }))
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})

describe('되돌릴 수 없다고 먼저 말한다', () => {
  it('확정 버튼 옆에 그 말이 있다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    await waitFor(() => expect(screen.getByText('만든 뒤에는 지울 수 없어요')).toBeTruthy())
  })
})

/*
 * 바꿀 수 없는 값에 기본값을 두면 만든 사람이 고른 적 없는 상태가 영구히 고정된다.
 * 계약: docs/API.md
 */
describe('공개 여부는 만드는 사람이 고른다', () => {
  it('고르기 전에는 확정할 수 없다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    await user.type(await screen.findByLabelText('이름'), '동네빵집')
    await user.click(screen.getByRole('radio', { name: '🍞' }))
    await user.type(screen.getByLabelText('발행 상한'), '1000000')

    // 어느 쪽도 미리 눌려 있지 않다.
    const chosen = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)
    expect(chosen.map((r) => (r as HTMLInputElement).value)).not.toContain('public')
    expect(screen.getByRole('button', { name: '꾹 눌러서 만들기' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('비공개로 만들면 비공개로 남는다', async () => {
    const user = userEvent.setup()
    await fillForm(user, '🍞', '비공개')
    await hold(750)

    expect(await screen.findByText('만들었어요', {}, { timeout: 5000 })).toBeTruthy()
    const created = await endpoints.pointTypes()
    expect(created.find((type) => type.name === '동네빵집')).toMatchObject({
      visibility: 'private',
    })
  })

  it('만든 뒤에는 바꿀 수 없다고 미리 말한다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    expect(await screen.findByText('만든 뒤에는 바꿀 수 없어요')).toBeTruthy()
  })
})

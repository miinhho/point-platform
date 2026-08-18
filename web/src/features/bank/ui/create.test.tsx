// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
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

async function fillForm(user: ReturnType<typeof userEvent.setup>, symbol = 'BK') {
  renderApp(<App />)
  await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
  await user.type(await screen.findByLabelText('이름'), '동네빵집')
  await user.type(screen.getByLabelText('기호'), symbol)
  await user.type(screen.getByLabelText('발행 상한'), '1000000')
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

  it('겹친 기호는 그 자리에서 말한다 — 실패 화면으로 보내지 않는다', async () => {
    const user = userEvent.setup()
    await fillForm(user, 'ON')
    await hold(750)

    expect(await screen.findByText('이미 쓰는 기호예요', {}, { timeout: 5000 })).toBeTruthy()
    // 입력을 잃지 않는다. 기호만 고치면 된다.
    expect(screen.getByLabelText('이름')).toHaveProperty('value', '동네빵집')
    expect(screen.getByText('포인트 만들기')).toBeTruthy()
  })

  it('확정 전에 카드 모습을 보여준다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    const preview = screen.getByText('이렇게 보여요').parentElement!
    expect(preview.textContent).toContain('동네빵집')
    expect(preview.textContent).toContain('BK')
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

  it('소문자로 쳐도 대문자로 보인다 — 화면과 결과가 같아야 한다', async () => {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    await user.type(await screen.findByLabelText('기호'), 'bk')
    expect(screen.getByLabelText('기호')).toHaveProperty('value', 'BK')
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
describe('색 6택은 진짜 라디오그룹이다', () => {
  async function openForm() {
    const user = userEvent.setup()
    renderApp(<App />)
    await user.click(await screen.findByRole('button', { name: '포인트 만들기' }))
    await screen.findByLabelText('기호')
    return user
  }

  // 방향키 순회는 같은 name 을 공유하는 네이티브 라디오가 브라우저에서 주는 것이다.
  it('여섯이 한 그룹을 이룬다', async () => {
    await openForm()
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(6)
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1)
    expect(radios[0].name).not.toBe('')
  })

  it('탭 정지점은 그룹당 하나다 — 여섯 번 눌러야 상한에 닿지 않는다', async () => {
    const user = await openForm()
    screen.getByLabelText('기호').focus()

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '파랑' }))
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
describe('겹친 기호를 고칠 자리로 포커스가 간다', () => {
  it('실패하면 기호 입력에 포커스가 있다', async () => {
    const user = userEvent.setup()
    await fillForm(user, 'ON')
    await hold(750)

    await screen.findByText('이미 쓰는 기호예요', {}, { timeout: 5000 })
    expect(document.activeElement).toBe(screen.getByLabelText('기호'))
  })

  // 관측: docs/FIELD.md 「W2/W3 재확인」 2 — 고친 뒤에도 문구가 남아 있었다.
  it('기호를 고치면 겹침 문구가 사라진다', async () => {
    const user = userEvent.setup()
    await fillForm(user, 'ON')
    await hold(750)
    await screen.findByText('이미 쓰는 기호예요', {}, { timeout: 5000 })

    await user.clear(screen.getByLabelText('기호'))
    await user.type(screen.getByLabelText('기호'), 'ZZ')
    expect(screen.queryByText('이미 쓰는 기호예요')).toBeNull()
    // 그 자리는 다시 안내로 돌아간다 — 비워 두면 무엇을 치라는 것인지 사라진다
    expect(screen.getByText(/영문 두세 글자/)).toBeTruthy()
  })
})

/*
 * 관측: docs/FIELD.md 「W2/W3 재확인」 — NETWORK 실패에서 폼이 리셋된 것처럼 보였는데
 * 그때 이 파일이 HMR 로 다시 마운트되고 있었다. 둘을 가르는 것은 테스트뿐이다.
 */
describe('만들지 못해도 입력을 버리지 않는다', () => {
  it('네트워크 실패 뒤에도 이름·기호·상한이 그대로다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    setSim({ forceFailure: 'NETWORK' })
    await hold(750)

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveProperty(
      'textContent',
      '서버에 닿지 못했어요',
    )
    expect(screen.getByLabelText('이름')).toHaveProperty('value', '동네빵집')
    expect(screen.getByLabelText('기호')).toHaveProperty('value', 'BK')
    expect(screen.getByLabelText('발행 상한')).toHaveProperty('value', '1,000,000')
  })

  // 결과를 알 수 없는 실패다. 키 입력 하나로 지우면 "만들어졌는지 모른다"가 사라진다.
  it('기호를 고쳐도 결과를 알 수 없다는 말은 남는다', async () => {
    const user = userEvent.setup()
    await fillForm(user)
    setSim({ forceFailure: 'NETWORK' })
    await hold(750)
    await screen.findByRole('alert', {}, { timeout: 5000 })

    await user.type(screen.getByLabelText('기호'), 'Z')
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

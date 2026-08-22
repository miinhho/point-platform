import { beforeEach, describe, expect, it } from 'vitest'
import { authApi } from './auth'
import { historyApi } from './history'
import { ApiError, newIdempotencyKey, request, setTokens } from './http'
import { invitesApi } from './invites'
import { issuesApi } from './issues'
import { pointsApi } from './points'
import { transfersApi } from './transfers'
import { usersApi } from './users'
import { walletApi } from './wallet'
import type { PointTypeId } from '@/shared/contract'
import { balanceOf, SEED_ISSUER as ME } from '@/mocks/ledger'
import { expireAccessTokens } from '@/mocks/sessions'
import { setSim } from '@/mocks/sim'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'

/**
 * HTTP 계약 시나리오.
 *
 * 인메모리 객체를 부르지 않고 실제 `fetch` 를 한다. MSW 가 앱과 같은 핸들러로
 * 그것을 받으므로, 여기서 통과하는 것은 상태 코드와 헤더까지 포함한 계약이다.
 */
/**
 * HTTP 표면 전체를 한 자리에서 부른다. 계약 시나리오는 엔티티 경계를 넘나들므로
 * (초대 → 수락 → 이체) 여기서만 합친다. 화면 코드는 엔티티 모듈을 직접 쓴다.
 */
const endpoints = {
  ...authApi,
  ...walletApi,
  ...usersApi,
  ...pointsApi,
  ...invitesApi,
  ...transfersApi,
  ...issuesApi,
  ...historyApi,
}

const key = () => newIdempotencyKey()

// 모든 읽기·쓰기가 토큰을 통과한다. 인증 없는 호출은 401 이다.
const TOKEN = { value: '' }

beforeEach(async () => {
  const session = await endpoints.login({ handle: '@minho', password: 'point' })
  TOKEN.value = session.accessToken
  setTokens(session)
})

describe('조회', () => {
  it('내 정보', async () => {
    await expect(endpoints.me()).resolves.toMatchObject({ id: ME, name: '장민호' })
  })

  it('지갑은 포인트별 잔액을 준다 — 이 앱에서 잔액은 하나가 아니다', async () => {
    const wallet = await endpoints.wallet()
    const byId = new Map(wallet.balances.map((b) => [b.pointType.id, b.amount]))
    expect(byId.get('pt_on')).toBe(3_240_000)
    expect(byId.get('pt_sol')).toBe(87_500)
    expect(byId.get('pt_gm')).toBe(620_000)
  })

  // 사람 이름이 겹치는 것과 같은 위험이다. 이름으로 포인트를 찾을 수 없다.
  it('이름이 같은 포인트가 둘 있고 발행자로만 갈린다', async () => {
    const wallet = await endpoints.wallet()
    const sameName = wallet.balances.filter((b) => b.pointType.name === '온포인트')
    expect(sameName).toHaveLength(2)
    // 겹칠 때 가르는 것은 발행자다. 이모지는 알아보는 표식이지 가리키는 표식이 아니다.
    expect(new Set(sameName.map((b) => b.pointType.issuerId)).size).toBe(2)
  })

  it('내가 발행자인 포인트는 잔액이 0이어도 지갑에 남는다', async () => {
    // 금머니를 다 보내도 발행자에게는 그 포인트가 계속 보여야 한다.
    await endpoints.createTransfer(
      { pointTypeId: 'pt_gm', toId: 'u_jisu', amount: 620_000 },
      key(),
    )
    const wallet = await endpoints.wallet()
    const gm = wallet.balances.find((b) => b.pointType.id === 'pt_gm')
    expect(gm).toMatchObject({ amount: 0 })
  })

  it('이름 검색은 그 이름인 사람을 모두 준다 — 화면이 구별을 책임진다', async () => {
    const found = await endpoints.users('김지수')
    expect(found.map((u) => u.handle).sort()).toEqual(['@jisoo', '@jisu'])
  })

  /*
   * 맞는 사람만 온다. 겹침을 결과 안에서 세면 방어가 꺼지지만, 그것은 `nameIsShared`
   * 가 없던 때의 이야기다 — 서버가 원장 전체를 보고 답하므로 한 명짜리 결과에서도
   * 켜져 있다. 함께 담으면 부작용만 남는다: 핸들로 찾은 사람에게 모르는 사람이 딸려 온다.
   */
  it('핸들로 검색해 한 명만 맞으면 그 한 명만 준다. 겹침 표시는 켜져 있다', async () => {
    const found = await endpoints.users('@jisu')
    expect(found.map((u) => u.handle)).toEqual(['@jisu'])
    expect(found[0].nameIsShared).toBe(true)
  })

  /*
   * **포인트별이면서 사람별이다.** 은행별로만 두면 그 은행에서 누가 최근에 받았는지를
   * 아무에게나 답하게 된다 — 계약: docs/API.md 「그 포인트로 최근에 **보낸** 사람」.
   * 실서버가 요청자에 매어 답하는 것을 대조로 확인했다.
   */
  it('최근 대상은 사람마다 다르다 — 한 번도 안 보낸 사람에게는 비어 있다', async () => {
    const session = await endpoints.login({ handle: '@jisoo', password: 'point' })
    setTokens(session)
    expect(await endpoints.recent('pt_on')).toEqual([])
  })

  // 포인트별 최근 대상이 이 계약의 핵심 중 하나다.
  it('최근 대상은 포인트마다 다르다', async () => {
    const on = await endpoints.recent('pt_on')
    const sol = await endpoints.recent('pt_sol')
    const gm = await endpoints.recent('pt_gm')
    expect(on.map((u) => u.id)).toEqual(['u_jisoo', 'u_taeyun', 'u_junho'])
    expect(sol.map((u) => u.id)).toEqual(['u_seoyeon'])
    expect(gm.map((u) => u.id)).toEqual(['u_jisu'])
  })
})

describe('이체', () => {
  it('확정되어 돌아오고 잔액이 움직인다', async () => {
    const transfer = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 },
      key(),
    )
    expect(transfer.occurredAt).toBeTruthy()
    expect(transfer.pointTypeId).toBe('pt_on')
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
    expect(balanceOf('pt_on', 'u_jisoo')).toBe(842_000)
  })

  // 다중 포인트가 만드는 새 위험의 반대편 보증이다.
  it('한 포인트를 보내도 다른 포인트 잔액은 그대로다', async () => {
    await endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 }, key())
    expect(balanceOf('pt_sol', ME)).toBe(87_500)
    expect(balanceOf('pt_gm', ME)).toBe(620_000)
  })

  it('확정되면 그 포인트의 최근 목록 맨 앞으로 온다', async () => {
    await endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_seoyeon', amount: 1_000 }, key())
    const recent = await endpoints.recent('pt_on')
    expect(recent[0].id).toBe('u_seoyeon')
    // 다른 포인트의 최근 목록은 영향받지 않는다
    const gm = await endpoints.recent('pt_gm')
    expect(gm.map((u) => u.id)).toEqual(['u_jisu'])
  })
})

describe('멱등성 — 이중 이체를 막는 것은 이 헤더뿐이다', () => {
  it('같은 키로 두 번 보내면 이체가 하나만 생긴다', async () => {
    const k = key()
    const first = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 },
      k,
    )
    const second = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 },
      k,
    )
    expect(second.id).toBe(first.id)
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
    await expect(endpoints.history()).resolves.toHaveLength(1)
  })

  it('키 없는 쓰기는 거절한다 — 받아 주면 조용히 이중 이체가 가능해진다', async () => {
    await expect(
      fetch('http://localhost/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN.value}` },
        body: JSON.stringify({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 1 }),
      }).then((r) => r.status),
    ).resolves.toBe(400)
  })
})

describe('거절', () => {
  it('잔액을 넘으면 422 와 코드를 준다', async () => {
    const error = await endpoints
      .createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 9_999_999 }, key())
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'INSUFFICIENT_BALANCE', status: 422, outcomeUnknown: false })
  })

  it('없는 사람은 404', async () => {
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_nobody', amount: 1 }, key()),
    ).rejects.toMatchObject({ code: 'RECIPIENT_NOT_FOUND', status: 404 })
  })

  it('없는 포인트는 404', async () => {
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_nope', toId: 'u_jisoo', amount: 1 }, key()),
    ).rejects.toMatchObject({ code: 'POINT_TYPE_NOT_FOUND' })
  })

  /**
   * 키패드로는 소수점을 칠 수 없다. 그래서 화면 QA 로는 절대 잡히지 않고,
   * 통과하면 잔액에 소수가 생겨 한글 병기가 그것을 조용히 버린다 — 숫자와 한글이
   * 다른 값을 말하게 되는 것은 여정 4 의 장치를 거꾸로 돌리는 일이다.
   */
  it('소수점 금액은 400 이고 잔액을 건드리지 않는다', async () => {
    const before = balanceOf('pt_on', ME)
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 0.5 }, key()),
    ).rejects.toMatchObject({ status: 400 })
    expect(balanceOf('pt_on', ME)).toBe(before)
  })

  it('정수로 셀 수 없이 큰 금액도 400 이다', async () => {
    await expect(
      endpoints.createTransfer(
        { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: Number.MAX_SAFE_INTEGER + 2 },
        key(),
      ),
    ).rejects.toMatchObject({ status: 400 })
  })

  // 포인트별 지갑이 하나씩이라 옮길 곳이 없다. 순효과 0 인 줄이 내역에만 남는다.
  it('나 자신에게 보내는 이체는 400 이다', async () => {
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_on', toId: ME, amount: 1 }, key()),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('발행', () => {
  it('발행자 지갑으로 들어오고 총 유통량이 늘어난다', async () => {
    const before = balanceOf('pt_gm', ME)
    const issued = await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 100_000 }, key())
    // 발행에는 상대가 없다. 발행자가 곧 받는 사람이라 칸이 하나다.
    expect(issued.issuerId).toBe(ME)
    expect(balanceOf('pt_gm', ME)).toBe(before + 100_000)

    const types = await endpoints.pointTypes()
    expect(types.find((t) => t.id === 'pt_gm')?.totalIssued).toBe(1_300_000)
  })

  async function refusedIssue(id: string): Promise<ApiError> {
    const error: unknown = await endpoints.issue(id).then(() => null, (thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(ApiError)
    return error as ApiError
  }

  /*
   * 발행 id 도 내역에서 새어 나갈 수 있으므로 남의 것과 없는 것이 같은 답이다. 다만
   * 이체의 코드를 빌리지는 않는다 — 화면이 코드로 갈리므로, 빌리면 발행 상세가
   * 이체 이야기를 한다. 계약: docs/API.md 「발행도 같다」
   */
  it('남의 발행은 없는 발행과 같은 답이고, 이체의 코드를 빌리지 않는다', async () => {
    const mine = await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 100_000 }, key())
    setTokens(await endpoints.login({ handle: '@jisoo', password: 'point' }))

    const theirs = await refusedIssue(mine.id)
    const nothing = await refusedIssue('is_nope')
    // 답이 갈리면 그 차이가 곧 「그 id 는 존재한다」가 된다
    expect([theirs.status, theirs.code, theirs.message]).toEqual([
      nothing.status,
      nothing.code,
      nothing.message,
    ])
    expect([theirs.status, theirs.code]).toEqual([404, 'ISSUE_NOT_FOUND'])
  })

  /*
   * 일어난 일은 일어난 때의 값을 갖는다. 지금 값에서 거꾸로 계산하면 그 사이 발행이
   * 끼거나 상한이 바뀌었을 때 틀린다. 계약: docs/API.md
   */
  it('그때의 유통량과 상한을 함께 잠근다', async () => {
    const first = await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 100_000 }, key())
    expect(first).toMatchObject({ totalIssuedAfter: 1_300_000, issueCapAt: 10_000_000 })

    // 그 뒤에 더 발행하고 상한을 바꿔도 앞의 기록은 그대로다.
    await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 50_000 }, key())
    await endpoints.changeCap('pt_gm', 20_000_000, key())

    expect(await endpoints.issue(first.id)).toMatchObject({
      issue: { totalIssuedAfter: 1_300_000, issueCapAt: 10_000_000 },
    })
  })

  it('남의 발행은 없는 것과 같다', async () => {
    const mine = await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 1_000 }, key())

    const session = await endpoints.login({ handle: '@jisoo', password: 'point' })
    setTokens(session)
    await expect(endpoints.issue(mine.id)).rejects.toMatchObject({ status: 404 })
  })

  it('멱등성 키로 조회한다 — 없으면 null 이다', async () => {
    const k = key()
    const issued = await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 1_000 }, k)

    expect(await endpoints.issueByKey(k)).toMatchObject({ id: issued.id })
    expect(await endpoints.issueByKey(key())).toBeNull()
  })

  // 대상을 실어 보내면 계약 위반이다. 조용히 무시하면 발행과 이체가 섞인다.
  it('대상을 실어 보내면 400 으로 거절한다', async () => {
    const response = await fetch('http://localhost/api/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key(),
        Authorization: `Bearer ${TOKEN.value}`,
      },
      body: JSON.stringify({ pointTypeId: 'pt_gm', toId: 'u_jisu', amount: 1 }),
    })
    expect(response.status).toBe(400)
  })

  it('상한을 넘으면 422', async () => {
    await expect(
      endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 99_000_000 }, key()),
    ).rejects.toMatchObject({ code: 'CAP_EXCEEDED' })
  })

  it('내 포인트가 아니면 403 — 권한은 화면이 아니라 서버가 막는다', async () => {
    await expect(
      endpoints.createIssue({ pointTypeId: 'pt_on', amount: 1 }, key()),
    ).rejects.toMatchObject({ code: 'NOT_ISSUER', status: 403 })
  })
})

describe('포인트 창설', () => {
  const bakery = {
    name: '동네빵집',
    emoji: '🍞',
    description: '골목 끝 빵집이에요',
    accent: 'orange' as const,
    issueCap: 1_000_000,
    visibility: 'public' as const,
  }

  it('만든 사람이 발행자이고 유통량은 0 에서 시작한다', async () => {
    const created = await endpoints.createPointType(bakery, key())
    expect(created).toMatchObject({
      name: '동네빵집',
      emoji: '🍞',
      issuerId: ME,
      totalIssued: 0,
      issueCap: 1_000_000,
      canIssue: true,
    })
  })

  // 만들자마자 홈에 있어야 한다. 잔액이 0 이라고 사라지면 발행하러 갈 길이 없다.
  it('만든 즉시 지갑에 잔액 0 으로 들어온다', async () => {
    const created = await endpoints.createPointType(bakery, key())
    const wallet = await endpoints.wallet()
    const mine = wallet.balances.find((b) => b.pointType.id === created.id)
    expect(mine).toMatchObject({ amount: 0 })
    expect(mine?.pointType.canIssue).toBe(true)
  })

  /*
   * 유일성을 버렸다. 쓸 만한 이모지는 몇백 개뿐이라 유일하게 두면 먼저 만든 사람이
   * 차지하는 경주가 되고, 사칭은 애초에 그것으로 막지 못한다. 계약: docs/API.md
   */
  it('표식이 겹쳐도 만들어진다', async () => {
    const first = await endpoints.createPointType(bakery, key())
    const second = await endpoints.createPointType({ ...bakery, name: '옆집' }, key())

    expect(second.emoji).toBe(first.emoji)
    expect(second.id).not.toBe(first.id)
  })

  it('목록 밖의 이모지는 400 이다', async () => {
    await expect(
      endpoints.createPointType({ ...bakery, emoji: '🏳️‍🌈' }, key()),
    ).rejects.toMatchObject({ status: 400 })
  })

  // 창설도 되돌릴 수 없다. 응답을 못 받고 다시 눌러도 하나만 생겨야 한다.
  it('같은 키로 두 번 보내면 하나만 생긴다', async () => {
    const k = key()
    const first = await endpoints.createPointType(bakery, k)
    const second = await endpoints.createPointType(bakery, k)
    expect(second.id).toBe(first.id)
    const types = await endpoints.pointTypes()
    expect(types.filter((t) => t.name === '동네빵집')).toHaveLength(1)
  })

  it.each([
    ['이름이 비었다', { name: '  ' }],
    ['이름이 13자다', { name: '가나다라마바사아자차카타파' }],
    ['표식이 목록에 없다', { emoji: '🦄' }],
    ['표식이 빈 문자열이다', { emoji: '' }],
    ['소개가 61자다', { description: '가'.repeat(61) }],
    ['상한이 소수다', { issueCap: 1.5 }],
    ['상한이 0 이다', { issueCap: 0 }],
    ['없는 색이다', { accent: 'crimson' as never }],
    // 나중에 바꿀 수 없는 값이다. 빠지면 서버가 기본값을 정하지 않는다.
    ['공개 여부가 없다', { visibility: undefined as never }],
    ['공개 여부가 그 둘이 아니다', { visibility: 'secret' as never }],
  ])('%s 면 400 이다', async (_label, patch) => {
    await expect(
      endpoints.createPointType({ ...bakery, ...patch }, key()),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('응답 유실 — 서버는 만들었는데 클라이언트가 못 받았다', () => {
  it('멱등성 키로 조회하면 일어난 것이 보인다', async () => {
    const k = key()
    setSim({ loseNextResponse: true })
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 }, k),
    ).rejects.toMatchObject({ code: 'NETWORK', outcomeUnknown: true })

    // 이쪽이 진짜 위험한 경우다. 잔액은 이미 움직였다.
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
    await expect(endpoints.transferByKey(k)).resolves.toMatchObject({ amount: 30_000 })
  })

  it('그 상태에서 재시도해도 잔액이 한 번만 움직인다', async () => {
    const k = key()
    setSim({ loseNextResponse: true })
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 }, k),
    ).rejects.toBeInstanceOf(ApiError)

    await endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 }, k)
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
    await expect(endpoints.history()).resolves.toHaveLength(1)
  })
})

describe('멱등성 키로 조회', () => {
  it('일어나지 않았으면 null 이다 — 404 가 아니다', async () => {
    await expect(endpoints.transferByKey('k_never')).resolves.toBeNull()
  })

  it('일어났으면 그 이체를 준다. 응답을 못 받은 클라이언트의 유일한 확인 수단이다', async () => {
    const k = key()
    const created = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 },
      k,
    )
    await expect(endpoints.transferByKey(k)).resolves.toMatchObject({ id: created.id })
  })
})

describe('결과를 아는지는 서버가 답한다', () => {
  // 계약: docs/API.md 「실패」. 코드에서 파생하면 코드를 늘릴 때마다 표를 함께
  // 늘려야 하고, 빠뜨리면 확정된 실패를 「어디까지 갔는지 알 수 없어요」로 말한다.
  it('잔액 부족은 아무것도 나가지 않았다고 단정할 수 있다', async () => {
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 9_999_999 }, key()),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE', outcome: 'none', outcomeUnknown: false })
  })

  it('형식 오류는 제 코드를 갖고 결과도 확정이다', async () => {
    await expect(endpoints.changeCap('pt_gm', 10_000_000, key())).rejects.toMatchObject({
      code: 'MALFORMED_REQUEST',
      status: 400,
      outcome: 'none',
    })
  })

  it('없는 이체는 제 코드를 갖는다 — 400 과 구별된다', async () => {
    await expect(endpoints.transfer('t_nope')).rejects.toMatchObject({
      code: 'TRANSFER_NOT_FOUND',
      status: 404,
      outcome: 'none',
    })
  })

  it('서버가 말하지 않으면 단정하지 않는다', async () => {
    server.use(
      http.get('*/api/wallet', () => HttpResponse.json({ code: 'SERVER' }, { status: 500 })),
    )
    await expect(endpoints.wallet()).rejects.toMatchObject({ outcome: 'unknown' })
  })
})

describe('결과를 알 수 없는 실패', () => {
  it('네트워크 실패는 전송 자체가 실패한다', async () => {
    setSim({ forceFailure: 'NETWORK' })
    const error = await endpoints.me().catch((e: unknown) => e)
    // 응답이 오지 않았다. 서버가 말할 수 없는 유일한 경우다.
    expect(error).toMatchObject({ code: 'NETWORK', status: null, outcome: 'unknown' })
  })

  it('서버 오류도 결과를 알 수 없다', async () => {
    setSim({ forceFailure: 'SERVER' })
    await expect(endpoints.me()).rejects.toMatchObject({ code: 'SERVER', outcome: 'unknown' })
  })

  it('주입된 실패는 한 번만 쓰이고 소모된다', async () => {
    setSim({ forceFailure: 'NETWORK' })
    await expect(endpoints.me()).rejects.toBeInstanceOf(ApiError)
    await expect(endpoints.me()).resolves.toBeTruthy()
  })

  it('결과를 모를 때 같은 키로 재시도하면 하나만 생긴다', async () => {
    const k = key()
    setSim({ forceFailure: 'NETWORK' })
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 }, k),
    ).rejects.toMatchObject({ outcomeUnknown: true })

    // 네트워크 실패는 서버에 닿지 못했으므로 아무것도 일어나지 않았다
    expect(balanceOf('pt_on', ME)).toBe(3_240_000)

    await endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 }, k)
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
    await expect(endpoints.history()).resolves.toHaveLength(1)
  })
})

describe('이체는 관여한 사람만 읽는다', () => {
  // 계약: docs/API.md. 이체 id 는 내역에서 새어 나갈 수 있으므로 403 으로 가르지 않는다.
  const OUTSIDER = { handle: '@jisoo', password: 'point' }

  async function switchTo(credentials: typeof OUTSIDER) {
    setTokens(await endpoints.login(credentials))
  }

  /** `@minho` 가 `@taeyun` 에게 보낸다. `@jisoo` 는 어느 쪽도 아니다. */
  async function transferBetweenOthers() {
    const idempotencyKey = key()
    const created = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_taeyun', amount: 1_000 },
      idempotencyKey,
    )
    return { created, idempotencyKey }
  }

  async function refusalOf(id: string): Promise<ApiError> {
    const error: unknown = await endpoints.transfer(id).then(() => null, (thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(ApiError)
    return error as ApiError
  }

  it('남의 이체는 404 다 — 없는 id 와 같은 답이다', async () => {
    const { created } = await transferBetweenOthers()
    await switchTo(OUTSIDER)

    const theirs = await refusalOf(created.id)
    const nothing = await refusalOf('t_nope')
    // 응답이 다르면 그 차이가 곧 "그 id 는 존재한다" 는 답이 된다.
    expect([theirs.status, theirs.code, theirs.message]).toEqual([
      nothing.status,
      nothing.code,
      nothing.message,
    ])
    expect(theirs.status).toBe(404)
  })

  it('남의 멱등성 키는 null 이다 — 없을 때와 구별되지 않는다', async () => {
    const { idempotencyKey } = await transferBetweenOthers()
    await switchTo(OUTSIDER)

    await expect(endpoints.transferByKey(idempotencyKey)).resolves.toBeNull()
    await expect(endpoints.transferByKey('k_never')).resolves.toBeNull()
  })

  it('남의 이체는 내역에도 없다', async () => {
    await transferBetweenOthers()
    await switchTo(OUTSIDER)
    await expect(endpoints.history()).resolves.toEqual([])
  })

  it('보낸 쪽은 자기 이체를 그대로 읽는다', async () => {
    const { created, idempotencyKey } = await transferBetweenOthers()
    // 상세는 그 줄이 어느 포인트인지 함께 준다 — 화면이 지갑을 뒤지지 않게.
    await expect(endpoints.transfer(created.id)).resolves.toMatchObject({
      transfer: { id: created.id },
      point: { name: '온포인트' },
    })
    await expect(endpoints.transferByKey(idempotencyKey)).resolves.toMatchObject({ id: created.id })
  })

  /*
   * 받은 쪽에게도 "돈이 어디 있는가" 를 답해야 한다 — docs/JOURNEY.md 여정 6.
   *
   * **상대와 방향은 보는 사람마다 다르다.** 기록할 때 하나로 정해 두면 받은 사람의
   * 내역에 자기 이름이 상대로 뜬다 — 화면은 그것을 「내가 나에게 보냈다」로 그린다.
   */
  it('받은 쪽도 읽는다. 상대는 보낸 사람이고 방향은 뒤집혀 있다', async () => {
    const created = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 1_000 },
      key(),
    )
    expect(created).toMatchObject({ outgoing: true, counterparty: { handle: '@jisoo' } })

    await switchTo(OUTSIDER)
    await expect(endpoints.transfer(created.id)).resolves.toMatchObject({
      transfer: { id: created.id, outgoing: false, counterparty: { handle: '@minho' } },
    })
  })

  // 남의 키로 내 요청을 보내도 남의 이체가 돌아오지 않는다.
  it('멱등성 재사용 판정도 요청자별이다', async () => {
    const { created, idempotencyKey } = await transferBetweenOthers()
    await switchTo(OUTSIDER)

    const own = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_taeyun', amount: 500 },
      idempotencyKey,
    )
    expect(own.id).not.toBe(created.id)
    // 내 이체다 — 보낸 쪽이 나이고 상대는 내가 고른 사람이다.
    expect(own).toMatchObject({ outgoing: true, counterparty: { handle: '@taeyun' } })
  })
})

describe('은행 페이지', () => {
  it('흉내낼 수 없는 것을 함께 싣는다', async () => {
    const bank = await endpoints.pointType('pt_on')
    expect(bank).toMatchObject({
      issuerHandle: '@onmart',
      visibility: 'public',
      totalIssued: 50_000_000,
    })
    expect(Number.isNaN(Date.parse(bank.createdAt))).toBe(false)
  })

  // 처음 만나는 순간에 판단하는 자리다. 안 가진 사람에게 닫으면 판단할 곳이 없다.
  it('그 포인트를 갖지 않은 사람도 읽는다', async () => {
    const wallet = await endpoints.wallet()
    expect(wallet.balances.some((b) => b.pointType.id === 'pt_sol' && b.amount > 0)).toBe(true)

    const bank = await endpoints.pointType('pt_sol')
    // 보는 사람 기준의 판정은 그대로 온다.
    expect(bank.canIssue).toBe(false)
  })

  it('없는 포인트는 404 다', async () => {
    await expect(endpoints.pointType('pt_nope')).rejects.toMatchObject({
      code: 'POINT_TYPE_NOT_FOUND',
      status: 404,
    })
  })
})

/**
 * 비공개 은행은 초대 없이 닿을 수 없다. 403 으로 답하면 「그 은행은 존재한다」를
 * 알려 주는 셈이고, 존재를 감추는 것이 비공개의 뜻이다. 계약: docs/API.md
 */
describe('비공개 은행은 회원이 아니면 없는 것과 같다', () => {
  /** `@jisu` 는 시드의 어느 비공개 은행에도 없다 */
  const asOutsider = async () => {
    const session = await endpoints.login({ handle: '@jisu', password: 'point' })
    setTokens(session)
  }
  const asIssuer = async () => {
    const session = await endpoints.login({ handle: '@minho', password: 'point' })
    setTokens(session)
  }

  it('회원에게는 보인다', async () => {
    expect(await endpoints.pointType('pt_cl')).toMatchObject({ visibility: 'private' })
  })

  it('회원이 아니면 403 이 아니라 404 다', async () => {
    await asOutsider()
    await expect(endpoints.pointType('pt_cl')).rejects.toMatchObject({
      code: 'POINT_TYPE_NOT_FOUND',
      status: 404,
    })
  })

  it('목록에도 담기지 않는다', async () => {
    await asOutsider()
    const types = await endpoints.pointTypes()
    expect(types.map((type) => type.id)).not.toContain('pt_cl')
    // 공개 은행은 그대로 온다.
    expect(types.map((type) => type.id)).toContain('pt_on')
  })

  /*
   * 은행 조회만 감추면 모자란다. 후보 목록이 그 은행의 회원을 그대로 답하면 **감춘
   * 은행의 명부가 다른 문으로 나온다.** 실서버는 `[]` 로 답한다 — 대조로 확인했다.
   */
  it('회원이 아니면 후보 목록이 비어 있다', async () => {
    await asOutsider()
    expect(await endpoints.users('', 'pt_cl')).toEqual([])
  })

  /*
   * **길이가 답이 되면 안 된다.** 없는 은행에는 아무나 담아 주고 감춘 은행에는 빈
   * 목록을 주면, 빈 목록이 「그 은행은 있다」가 된다. 물어본 사람이 새로 아는 것이
   * 없어야 한다 — 계약: docs/API.md 「비공개 은행에서 회원이 아닌 사람은 없는
   * 사람과 구별되지 않아야 한다」
   */
  it('없는 은행과 못 보는 은행이 같은 답이다', async () => {
    await asOutsider()
    expect(await endpoints.users('', 'pt_없는것' as PointTypeId)).toEqual([])
  })

  it('회원에게는 그대로 온다 — 감추는 것이 지우는 것이 되지 않는다', async () => {
    const handles = (await endpoints.users('', 'pt_cl')).map((user) => user.handle)
    expect(handles).toContain('@jisoo')
    expect(handles).not.toContain('@minho')
  })

  /*
   * 후보 목록 옆에 같은 문이 하나 더 있었다. 최근 목록은 **명부보다 더 새는 쪽이다** —
   * 명부는 누가 속하는지고 이것은 누가 움직였는지라, 길이가 0 이 아닌 것 하나로
   * 감춘 은행의 존재까지 드러난다. 실서버는 `[]` 로 답한다.
   */
  it('회원이 아니면 최근 목록도 비어 있다', async () => {
    await asOutsider()
    expect(await endpoints.recent('pt_cl')).toEqual([])
    expect(await endpoints.recent('pt_없는것' as PointTypeId)).toEqual([])
  })

  /*
   * **한 번도 안 보낸 사람은 이것을 증명하지 못한다.** 그 사람은 애초에 목록이 없어서,
   * 감추는 것이 없어도 빈 답이 온다. 재려면 **보낸 적이 있고 지금은 남남인** 사람이
   * 있어야 한다 — 나가면서 자기 목록이 사라지는 것이 아니기 때문이다.
   */
  it('보낸 적이 있어도 나간 뒤에는 최근 목록이 비어 있다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    await asOutsider()
    await endpoints.acceptInvite('pt_cl')

    await asIssuer()
    await endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: 'u_jisu', amount: 5_000 }, key())

    await asOutsider()
    await endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: 'u_jisoo', amount: 1_000 }, key())
    expect((await endpoints.recent('pt_cl')).map((user) => user.id)).toEqual(['u_jisoo'])

    await endpoints.leaveBank('pt_cl')
    expect(await endpoints.recent('pt_cl')).toEqual([])
  })

  it('만든 사람은 자기 비공개 은행에 닿는다', async () => {
    const created = await endpoints.createPointType(
      { name: '모임', emoji: '🎵', description: '', accent: 'teal', issueCap: 1_000, visibility: 'private' },
      key(),
    )
    expect(await endpoints.pointType(created.id)).toMatchObject({ id: created.id })
  })
})

/**
 * 나가기·내보내기는 포인트를 회수하지 않는다. 잔액은 그대로 남고 쓸 수 없다 —
 * 계약: docs/API.md. 지금은 시드가 그 상태를 갖고, 나가기는 뒤에 온다.
 */
describe('쓸 수 없는 잔액', () => {
  it('회원이 아닌 은행의 잔액은 보낼 수 있는 양이 0 이다', async () => {
    // `@jisu` 는 금머니만 가졌다. 회원이 아닌 비공개 은행에 잔액을 심는다.
    const wallet = await endpoints.wallet()
    const held = wallet.balances.find((b) => b.pointType.id === 'pt_hd')
    expect(held).toMatchObject({ amount: 25_000, sendable: 25_000 })
  })

  it('회원이 아닌 사람에게는 보낼 수 없다 — 새 코드를 만들지 않는다', async () => {
    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: 'u_taeyun', amount: 1_000 }, key()),
    ).rejects.toMatchObject({ code: 'RECIPIENT_NOT_FOUND', status: 404 })
  })

  it('받는 사람 목록이 회원으로 좁아진다', async () => {
    // `pt_cl` 의 회원은 나와 `@jisoo` 뿐이다. 요청자는 결과에서 빠진다.
    const members = await endpoints.users(undefined, 'pt_cl')
    expect(members.map((user) => user.handle)).toEqual(['@jisoo'])

    // 공개 은행이면 좁히지 않는다.
    const everyone = await endpoints.users(undefined, 'pt_on')
    expect(everyone.length).toBeGreaterThan(1)
  })

  it('검색해도 회원 밖으로 나가지 않는다', async () => {
    // `@taeyun` 은 원장에 있지만 `pt_cl` 의 회원이 아니다.
    expect((await endpoints.users('태윤')).map((u) => u.handle)).toContain('@taeyun')
    expect(await endpoints.users('태윤', 'pt_cl')).toEqual([])
  })

  it('회원끼리는 보낼 수 있다', async () => {
    const sent = await endpoints.createTransfer(
      { pointTypeId: 'pt_cl', toId: 'u_jisoo', amount: 1_000 },
      key(),
    )
    expect(sent).toMatchObject({ pointTypeId: 'pt_cl', amount: 1_000 })
  })
})

/**
 * 초대는 상태를 최소로 갖는다 — 거절도, 은행장의 취소도 없다. 무시하면 그만이다.
 * 계약: docs/API.md 「회원 자격」
 */
describe('초대와 수락', () => {
  const asJisu = async () => {
    const session = await endpoints.login({ handle: '@jisu', password: 'point' })
    setTokens(session)
  }
  const asMe = async () => {
    const session = await endpoints.login({ handle: '@minho', password: 'point' })
    setTokens(session)
  }

  it('수락하면 회원이 되고 초대는 사라진다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())

    await asJisu()
    const [invited] = await endpoints.invites()
    expect(invited).toMatchObject({ byHandle: '@minho' })
    expect(invited.pointType).toMatchObject({ id: 'pt_cl', name: '동아리회비' })

    await endpoints.acceptInvite('pt_cl')
    expect(await endpoints.invites()).toEqual([])
    // 이제 목록에도 담기고 받는 사람으로도 뜬다.
    expect((await endpoints.pointTypes()).map((t) => t.id)).toContain('pt_cl')
  })

  // 초대를 열면 은행 페이지가 열린다. 거기가 판단하는 자리다.
  it('수락 전에도 은행 페이지는 열린다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    await asJisu()
    expect(await endpoints.pointType('pt_cl')).toMatchObject({ id: 'pt_cl' })
  })

  it('회원이 아니면 그 은행이 없는 것과 같다', async () => {
    await asJisu()
    await expect(endpoints.createInvite('pt_cl', 'u_taeyun', key())).rejects.toMatchObject({
      code: 'POINT_TYPE_NOT_FOUND',
      status: 404,
    })
  })

  // 회원은 그 은행이 있다는 것을 이미 안다. 감출 것이 없으므로 403 이다.
  it('은행장이 아닌 회원은 초대할 수 없다', async () => {
    const session = await endpoints.login({ handle: '@jisoo', password: 'point' })
    setTokens(session)
    await expect(endpoints.createInvite('pt_cl', 'u_taeyun', key())).rejects.toMatchObject({
      code: 'NOT_ISSUER',
      status: 403,
    })
  })

  it('공개 은행에는 초대가 없다', async () => {
    await expect(endpoints.createInvite('pt_gm', 'u_jisu', key())).rejects.toMatchObject({
      status: 404,
    })
  })

  it('같은 사람을 다시 초대하면 같은 초대가 온다', async () => {
    const first = await endpoints.createInvite('pt_cl', 'u_jisu', key())
    const second = await endpoints.createInvite('pt_cl', 'u_jisu', key())
    expect(second.id).toBe(first.id)

    await asJisu()
    expect(await endpoints.invites()).toHaveLength(1)
  })

  it('같은 키로 두 번 보내도 하나만 생긴다', async () => {
    const k = key()
    const first = await endpoints.createInvite('pt_cl', 'u_jisu', k)
    expect((await endpoints.createInvite('pt_cl', 'u_jisu', k)).id).toBe(first.id)
  })

  /*
   * 초대받지 않은 사람이 수락해도 「그 은행에 초대가 있다」를 알 수 없어야 한다.
   * 알려 주면 누가 초대됐는지가 샌다. 계약: docs/API.md 「회원 자격」
   */
  it('초대받지 않은 사람의 수락은 초대가 없을 때와 같은 답이다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())

    /*
     * `@taeyun` 은 `pt_cl` 의 회원도 초대받은 사람도 아니고 잔액도 없다 — 계약이
     * 말하는 「아무 관계 없는 사람」이다. **`code` 까지 본다.** 상태만 보면 있는 은행과
     * 없는 은행이 갈리는 것을 놓치고, 새는 것이 정확히 그 `code` 다.
     */
    setTokens(await endpoints.login({ handle: '@taeyun', password: 'point' }))
    const expected = { code: 'POINT_TYPE_NOT_FOUND', status: 404 }
    await expect(endpoints.acceptInvite('pt_cl')).rejects.toMatchObject(expected)
    await expect(endpoints.acceptInvite('pt_nope')).rejects.toMatchObject(expected)
    await asMe()
  })

  /*
   * 초대는 은행장의 행동이다 — 「내가 방금 초대했다」가 사실이 아니면 그렇게 말한다.
   * 계약: docs/API.md
   */
  it('이미 회원인 사람을 초대하면 409 다', async () => {
    // `@jisoo` 는 이미 `pt_cl` 의 회원이다.
    await expect(endpoints.createInvite('pt_cl', 'u_jisoo', key())).rejects.toMatchObject({
      code: 'ALREADY_MEMBER',
      status: 409,
    })
  })

  it('없는 사람을 초대하면 404 다', async () => {
    await expect(endpoints.createInvite('pt_cl', 'u_nobody', key())).rejects.toMatchObject({
      code: 'RECIPIENT_NOT_FOUND',
      status: 404,
    })
  })

  /*
   * 멱등은 「그가 원한 결과가 이미 있는가」로 판단한다. 수락을 누른 사람이 원한 것은
   * 회원이 되는 것이고 그는 이미 회원이다 — 응답을 못 받고 다시 누른 사람에게 실패를
   * 돌려주면 안 된다. 초대에서 409 인 것과 뒤집힌 것처럼 보이지만 기준은 하나다.
   */
  // 멱등은 「그가 원한 결과가 이미 있는가」로 판단한다. 그는 이미 회원이다
  it('두 번 수락해도 성공이다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    await asJisu()

    await endpoints.acceptInvite('pt_cl')
    expect(await endpoints.acceptInvite('pt_cl')).toMatchObject({ id: 'pt_cl' })
  })

  /*
   * 초대는 소진되면 새 행이 난다. 수락이 초대를 가리켰다면 화면이 쥔 id 가 낡아
   * **「초대받았어요」라고 떠 있는데 눌러도 404** 인 자리가 생겼다.
   * 은행을 가리키면 그 부류가 통째로 없다. 계약: docs/API.md
   */
  it('내보내졌다가 다시 초대받은 사람이 수락할 수 있다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    await asJisu()
    await endpoints.acceptInvite('pt_cl')

    await asMe()
    await endpoints.removeMember('pt_cl', 'u_jisu')
    await endpoints.createInvite('pt_cl', 'u_jisu', key())

    await asJisu()
    expect((await endpoints.pointType('pt_cl')).membership).toBe('invited')
    expect(await endpoints.acceptInvite('pt_cl')).toMatchObject({ id: 'pt_cl' })
  })
})

/**
 * 나가기와 내보내기는 같은 일을 하고 누가 정했느냐만 다르다. 둘 다 포인트를
 * 회수하지 않는다 — 계약: docs/API.md 「회원 자격」
 */
describe('나가기와 내보내기', () => {
  const asJisoo = async () => {
    const session = await endpoints.login({ handle: '@jisoo', password: 'point' })
    setTokens(session)
  }

  /*
   * **응답이 유실됐고 다시 눌렀다.** 그 사람이 아는 것은 「안 됐다」뿐이라 다시 누르고,
   * 이미 나간 상태다. 서버는 도달성으로 문을 열고 지우는 것은 없는 것을 지워도 되므로
   * `204` 다 — 계약: docs/API.md 「이미 나간 사람이 다시 나가도 `204`」.
   *
   * 회원인지로 문을 지키면 두 번째가 `404` 가 되고, **화면은 그것을 「이 은행이 없다」로
   * 읽는다.** 방금까지 보던 은행이다.
   */
  it('이미 나간 사람이 다시 나가도 성공이다', async () => {
    await asJisoo()
    await endpoints.leaveBank('pt_cl')
    // 잔액이 남아 도달성은 그대로다
    await expect(endpoints.leaveBank('pt_cl')).resolves.toBeUndefined()
  })

  /*
   * 「닿지 못하면 없는 은행」을 나가기에 적용하면 틀린다 — 잔액 0 으로 나간 사람은 더는
   * 닿지 못하므로 다시 눌렀을 때 「이 은행이 없어요」를 본다. 방금까지 보던 은행이다.
   * 그래서 답을 「지금 회원인가」 하나로 모은다. 계약: docs/API.md 「회원 자격」
   */
  it('닿지도 못하는 사람이 나가도 성공이다', async () => {
    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))
    await expect(endpoints.leaveBank('pt_cl')).resolves.toBeUndefined()
  })

  // 답이 하나라 존재가 새지 않는다. 갈리는 순간 없는 id 와 감춘 은행이 구별된다
  it('그 id 의 은행이 없어도 나가기는 성공이다', async () => {
    await expect(endpoints.leaveBank('pt_nope' as PointTypeId)).resolves.toBeUndefined()
  })

  // 공개 은행에는 회원이 없다. 「없는 은행」이라고 답하면 있는 은행에 거짓말을 한다
  it('공개 은행에서 나가려 하면 회원 개념이 없다고 답한다', async () => {
    await expect(endpoints.leaveBank('pt_on')).rejects.toMatchObject({
      code: 'NOT_A_PRIVATE_BANK',
    })
  })

  /*
   * 나간 사람은 지금 받을 수 없다. 최근 목록에 그대로 두면 화면이 **보낼 수 없는
   * 사람을 제일 누르기 쉬운 자리에 놓는다** — 그 자리는 대상 선택의 첫 줄이다.
   * 잔액처럼 지우는 것이 아니라 지금 보낼 수 있는 사람만 담는 것이다.
   */
  it('내보내진 사람은 최근 목록에서 빠진다', async () => {
    await endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: 'u_jisoo', amount: 1_000 }, key())
    expect((await endpoints.recent('pt_cl')).map((u) => u.id)).toEqual(['u_jisoo'])

    await endpoints.removeMember('pt_cl', 'u_jisoo')
    expect(await endpoints.recent('pt_cl')).toEqual([])
  })

  /** 계약: docs/API.md — 명부는 셋으로 답한다 */
  it('회원에게는 목록을 준다', async () => {
    expect((await endpoints.members('pt_cl')).map((u) => u.handle).sort()).toEqual([
      '@jisoo',
      '@minho',
    ])
  })

  // 공개 은행에 빈 배열을 주면 「지금 0명」으로 읽히고 클라이언트가 늘어나기를 기다린다.
  it('공개 은행에는 명부가 없다 — 비어 있는 것이 아니다', async () => {
    await expect(endpoints.members('pt_on')).rejects.toMatchObject({
      code: 'NOT_A_PRIVATE_BANK',
      status: 404,
    })
  })

  // 감출 것이 남아 있는 사람에게는 여전히 감춘다. 잔액도 회원 자격도 없는 사람이다.
  it('아무 관계 없는 사람에게는 그 은행이 없는 것과 같다', async () => {
    const session = await endpoints.login({ handle: '@jisu', password: 'point' })
    setTokens(session)
    await expect(endpoints.members('pt_cl')).rejects.toMatchObject({
      code: 'POINT_TYPE_NOT_FOUND',
      status: 404,
    })
  })

  it('나가도 잔액은 그대로 남고 쓸 수 없게 된다', async () => {
    await asJisoo()
    expect(balanceOf('pt_cl', 'u_jisoo')).toBe(30_000)

    await endpoints.leaveBank('pt_cl')

    // 지우지도 옮기지도 않는다.
    expect(balanceOf('pt_cl', 'u_jisoo')).toBe(30_000)
    const held = (await endpoints.wallet()).balances.find((b) => b.pointType.id === 'pt_cl')
    expect(held).toMatchObject({ amount: 30_000, sendable: 0 })
    // 잔액이 남아 있으면 은행 페이지는 계속 보인다 — 물으러 갈 곳이 필요하다.
    expect(await endpoints.pointType('pt_cl')).toMatchObject({ id: 'pt_cl' })
    // 명부는 오지 않는다. 감출 것이 남아 있지 않으므로 404 가 아니라 403 이다.
    await expect(endpoints.members('pt_cl')).rejects.toMatchObject({
      code: 'NOT_MEMBER',
      status: 403,
    })
  })

  /*
   * 서버가 못 한다고 답한 것을 서버가 해 주면 안 된다. 「대상이 없어요」로 답하면
   * 사용자가 받는 사람 핸들을 다시 확인하기 시작한다 — 계약: docs/API.md
   */
  it('나온 사람이 보내려 하면 NOT_MEMBER 다', async () => {
    await asJisoo()
    await endpoints.leaveBank('pt_cl')

    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: ME, amount: 100 }, key()),
    ).rejects.toMatchObject({ code: 'NOT_MEMBER', status: 403 })
  })

  // 잔액도 회원 자격도 없는 사람에게는 그 은행이 존재하지 않는다. 403 은 존재를 알려 준다.
  it('아무 관계 없는 사람에게는 여전히 404 다', async () => {
    const session = await endpoints.login({ handle: '@jisu', password: 'point' })
    setTokens(session)

    await expect(
      endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: ME, amount: 100 }, key()),
    ).rejects.toMatchObject({ code: 'POINT_TYPE_NOT_FOUND', status: 404 })
  })

  it('내보내도 같은 일이 일어난다 — 누가 정했느냐만 다르다', async () => {
    await endpoints.removeMember('pt_cl', 'u_jisoo')

    expect(balanceOf('pt_cl', 'u_jisoo')).toBe(30_000)
    await asJisoo()
    const held = (await endpoints.wallet()).balances.find((b) => b.pointType.id === 'pt_cl')
    expect(held).toMatchObject({ amount: 30_000, sendable: 0 })
  })

  it('다시 초대받으면 그대로 되살아난다', async () => {
    await endpoints.removeMember('pt_cl', 'u_jisoo')
    await endpoints.createInvite('pt_cl', 'u_jisoo', key())

    await asJisoo()
    await endpoints.acceptInvite('pt_cl')
    const held = (await endpoints.wallet()).balances.find((b) => b.pointType.id === 'pt_cl')
    expect(held).toMatchObject({ amount: 30_000, sendable: 30_000 })
  })

  it('은행장은 나갈 수 없다', async () => {
    await expect(endpoints.leaveBank('pt_cl')).rejects.toMatchObject({
      code: 'ISSUER_CANNOT_LEAVE',
      status: 409,
    })
  })

  it('은행장을 내보낼 수도 없다', async () => {
    await expect(endpoints.removeMember('pt_cl', ME)).rejects.toMatchObject({
      code: 'ISSUER_CANNOT_LEAVE',
      status: 409,
    })
  })

  it('은행장이 아니면 남을 내보낼 수 없다', async () => {
    await asJisoo()
    await expect(endpoints.removeMember('pt_cl', ME)).rejects.toMatchObject({
      code: 'NOT_ISSUER',
      status: 403,
    })
  })

  it('공개 은행에는 회원이 없으므로 나갈 것도 없다', async () => {
    await expect(endpoints.leaveBank('pt_on')).rejects.toMatchObject({ status: 404 })
    await expect(endpoints.members('pt_on')).rejects.toMatchObject({ status: 404 })
  })
})

/** 「봤어요」 버튼을 두지 않는다. 표시를 지우는 것은 실제로 쓴 일뿐이다 — 여정 10 */
describe('아직 쓰지 않은 포인트', () => {
  const heldOf = async (pointTypeId: string) =>
    (await endpoints.wallet()).balances.find((b) => b.pointType.id === pointTypeId)

  it('받기만 한 포인트는 neverSpent 다', async () => {
    expect(await heldOf('pt_on2')).toMatchObject({ neverSpent: true })
    expect(await heldOf('pt_on')).toMatchObject({ neverSpent: false })
  })

  it('한 번 보내면 꺼진다', async () => {
    await endpoints.createTransfer(
      { pointTypeId: 'pt_on2', toId: 'u_jisoo', amount: 1_000 },
      key(),
    )
    expect(await heldOf('pt_on2')).toMatchObject({ neverSpent: false })
  })

  // 발행은 쓰는 것이 아니다. 자기 지갑으로 들어올 뿐이다.
  it('발행으로는 꺼지지 않는다', async () => {
    const created = await endpoints.createPointType(
      { name: '빵집', emoji: '🍞', description: '', accent: 'orange', issueCap: 1_000, visibility: 'public' },
      key(),
    )
    await endpoints.createIssue({ pointTypeId: created.id, amount: 500 }, key())
    expect(await heldOf(created.id)).toMatchObject({ neverSpent: true })
  })
})

describe('내역', () => {
  it('최신순으로 주고 포인트로 걸러진다', async () => {
    const on = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 1_000 },
      key(),
    )
    const gm = await endpoints.createTransfer(
      { pointTypeId: 'pt_gm', toId: 'u_jisu', amount: 2_000 },
      key(),
    )
    await expect(endpoints.history()).resolves.toMatchObject([
      { type: 'transfer', transfer: { id: gm.id } },
      { type: 'transfer', transfer: { id: on.id } },
    ])
    await expect(endpoints.history({ pointTypeId: 'pt_on' })).resolves.toMatchObject([
      { type: 'transfer', transfer: { id: on.id } },
    ])
  })
})

describe('상한 변경', () => {
  // 계약: docs/API.md. 시드의 금머니는 @minho 가 발행자고 120만이 발행돼 있다.
  const GM = 'pt_gm'

  async function signInAs(handle: string) {
    setTokens(await endpoints.login({ handle, password: 'point' }))
  }

  it('발행자가 올리면 그 값이 상한이 된다', async () => {
    const changed = await endpoints.changeCap(GM, 20_000_000, key())
    expect(changed).toMatchObject({ id: GM, issueCap: 20_000_000 })
    const wallet = await endpoints.wallet()
    expect(wallet.balances.find((b) => b.pointType.id === GM)?.pointType.issueCap).toBe(20_000_000)
  })

  it('발행자가 아니면 403 이다 — 권한은 화면이 아니라 서버가 막는다', async () => {
    await expect(endpoints.changeCap('pt_on', 200_000_000, key())).rejects.toMatchObject({
      code: 'NOT_ISSUER',
      status: 403,
    })
  })

  // 그 아래로 내리면 유통량이 상한을 넘은 상태가 되어 상한이 뜻을 잃는다.
  it('이미 발행한 양보다 낮출 수 없다', async () => {
    await expect(endpoints.changeCap(GM, 1_000_000, key())).rejects.toMatchObject({
      code: 'CAP_BELOW_ISSUED',
      status: 422,
    })
  })

  it('이미 발행한 양과 같은 값까지는 내릴 수 있다', async () => {
    await expect(endpoints.changeCap(GM, 1_200_000, key())).resolves.toMatchObject({
      issueCap: 1_200_000,
    })
  })

  // 이력에 남는 사건이므로 아무것도 바꾸지 않는 줄을 만들지 않는다.
  it('지금과 같은 값이면 400 이다', async () => {
    await expect(endpoints.changeCap(GM, 10_000_000, key())).rejects.toMatchObject({ status: 400 })
  })

  // 「지금과 같은 값이면 400」이 멱등성 검사보다 앞서면, 성공한 요청이 400 으로 돌아온다.
  it('같은 키로 다시 보내면 같은 값이라고 거절하지 않는다', async () => {
    const k = key()
    await endpoints.changeCap(GM, 20_000_000, k)
    await expect(endpoints.changeCap(GM, 20_000_000, k)).resolves.toMatchObject({
      issueCap: 20_000_000,
    })
  })

  // 응답을 못 받고 다시 누르면 상한은 이미 새 값이다. 같은 값 판정이 앞서면
  // 성공한 요청이 400 으로 돌아온다.
  it('응답이 유실돼도 같은 키로 재시도하면 성립한다', async () => {
    const k = key()
    setSim({ loseNextResponse: true })
    await expect(endpoints.changeCap(GM, 20_000_000, k)).rejects.toBeInstanceOf(ApiError)

    await expect(endpoints.changeCap(GM, 20_000_000, k)).resolves.toMatchObject({
      issueCap: 20_000_000,
    })
  })

  /*
   * 원장 밖에 남는다 — 전기가 없어 사건이 되지 않는다(docs/LEDGER.md 4 단계).
   * 바꾼 사람의 내역에도 안 오르는 것이 요점이다: 「보유자에게만 안 보인다」면
   * 그것은 감추는 규칙인데, 여기서 정한 것은 **내역이 아니라는 것**이다.
   */
  it('내역에 오르지 않는다. 바꾼 사람에게도', async () => {
    const sent = await endpoints.createTransfer(
      { pointTypeId: GM, toId: 'u_jisu', amount: 1_000 },
      key(),
    )
    await endpoints.changeCap(GM, 20_000_000, key())

    await expect(endpoints.history()).resolves.toMatchObject([
      { type: 'transfer', transfer: { id: sent.id } },
    ])

    // 금머니를 45,000 가진 사람에게도 마찬가지다.
    await signInAs('@jisu')
    await expect(endpoints.history()).resolves.toMatchObject([
      { type: 'transfer', transfer: { id: sent.id } },
    ])
  })

  // 지금 상한은 늘 실려 온다 — 변경이 내역에서 빠져도 보유자가 상한을 아는 길은 남는다.
  it('바뀐 상한은 보유자의 은행 페이지에 그대로 보인다', async () => {
    await endpoints.changeCap(GM, 20_000_000, key())

    await signInAs('@jisu')
    await expect(endpoints.pointType(GM)).resolves.toMatchObject({ issueCap: 20_000_000 })
  })
})

/*
 * 없는 경로가 프레임워크 기본 404 로 새면 `code` 도 `outcome` 도 없고, 화면은
 * 그것을 「결과를 알 수 없다」로 읽는다 — 아무 일도 없던 요청을 두고 돈이 어디
 * 있는지 모른다고 말하게 된다. 관측: docs/FIELD.md W7 · 계약: docs/API.md
 */
describe('없는 경로', () => {
  it('계약 본문으로 답한다 — 형식 오류가 아니다', async () => {
    await expect(request('/totally-not-a-real-route')).rejects.toMatchObject({
      code: 'UNKNOWN_ENDPOINT',
      status: 404,
    })
  })

  it('결과를 안다고 답한다 — 단정하지 못하게 두지 않는다', async () => {
    const thrown = await request('/nope').then(
      () => null,
      (error: unknown) => error,
    )
    expect(thrown).toBeInstanceOf(ApiError)
    expect((thrown as ApiError).outcomeUnknown).toBe(false)
  })
})

describe('토큰 갱신', () => {
  it('access 가 만료되면 갱신하고 원요청을 다시 보낸다', async () => {
    expireAccessTokens()
    // 사용자는 만료를 알 필요가 없다. 요청이 그냥 성공한다.
    await expect(endpoints.wallet()).resolves.toMatchObject({ user: { id: ME } })
  })

  // 멱등성 키가 헤더에 있어서 재시도가 안전하다. 그 설계가 여기서 값을 한다.
  it('쓰기 도중 만료돼도 이체가 하나만 생긴다', async () => {
    expireAccessTokens()
    await endpoints.createTransfer({ pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 30_000 }, key())
    expect(balanceOf('pt_on', ME)).toBe(3_210_000)
    await expect(endpoints.history()).resolves.toHaveLength(1)
  })

  it('refresh 도 죽었으면 401 이 그대로 올라온다', async () => {
    setTokens({ accessToken: 'dead', refreshToken: 'dead' })
    await expect(endpoints.wallet()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  // 회전된 refresh 가 다시 오면 훔친 것일 수 있다. 사슬 전체를 끊는다.
  it('이미 쓴 refresh 를 다시 쓰면 그 세션이 통째로 죽는다', async () => {
    const session = await endpoints.login({ handle: '@minho', password: 'point' })
    setTokens(session)

    const rotated = await endpoints.refresh(session.refreshToken)
    // 옛 refresh 재사용 → 사슬 무효화
    await expect(endpoints.refresh(session.refreshToken)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    // 회전으로 받은 새 refresh 도 함께 죽는다
    await expect(endpoints.refresh(rotated.refreshToken)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('동시에 여러 요청이 만료를 만나도 갱신은 한 번만 돈다', async () => {
    expireAccessTokens()
    const [wallet, users, types] = await Promise.all([
      endpoints.wallet(),
      endpoints.users(),
      endpoints.pointTypes(),
    ])
    expect(wallet.user.id).toBe(ME)
    expect(users.length).toBeGreaterThan(0)
    expect(types.length).toBeGreaterThan(0)
  })
})

/**
 * 무엇을 증명하고 무엇을 증명하지 않는가.
 *
 * **증명한다**: Mock 이 계약에서 멀어지지 않는다.
 * **증명하지 않는다**: 실서버가 계약을 지킨다. 여기서 도는 것은 MSW 핸들러뿐이라
 * 서버의 같은 결함(초대 행을 남겨 내보낸 사람이 걸어 들어온 것 — `aed8d72`)은
 * 이 테스트로 잡히지 않았고 앞으로도 안 잡힌다.
 *
 * 그래도 두는 이유는 그 결함이 Mock 에는 **우연히** 없었기 때문이다. 우연은
 * 다음 변경에서 사라진다.
 */
describe('Mock 이 회원 자격 계약에서 멀어지지 않는다', () => {
  it('내보낸 사람의 초대함에 그 은행이 남지 않는다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())

    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))
    expect(await endpoints.invites()).toHaveLength(1)
    await endpoints.acceptInvite('pt_cl')
    // 수락하면 소진된다
    await expect(endpoints.invites()).resolves.toEqual([])

    /*
     * 잔액을 남긴 채 내보낸다. **이쪽이 날카로운 경우다** — 잔액이 있으면 그 은행에
     * 여전히 닿으므로 은행 페이지가 보이고, 그래서 「닿는데 초대가 없다」는 답을
     * 실제로 받는다. 잔액이 없으면 은행 자체가 안 보여서 다른 문에서 막힌다.
     */
    setTokens(await endpoints.login({ handle: '@minho', password: 'point' }))
    await endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: 'u_jisu', amount: 100 }, key())
    await endpoints.removeMember('pt_cl', 'u_jisu')

    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))
    // 남아 있으면 내보내진 사람이 스스로 걸어 들어온다. 은행장에게는 막을 수단이 없다
    await expect(endpoints.invites()).resolves.toEqual([])
    expect((await endpoints.pointType('pt_cl')).membership).toBe('outsider')

    /*
     * 목록에서 숨기는 것만으로는 부족하다. 목록을 안 거치고 바로 수락하는 길이
     * 있으므로 그 문도 닫혀 있어야 「걸어 들어오지 못한다」가 참이다.
     */
    await expect(endpoints.acceptInvite('pt_cl')).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
      status: 404,
    })
  })

  it('소진된 뒤 다시 초대하면 새 초대가 온다 — 되살리는 것은 은행장의 새 의사다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))
    const first = (await endpoints.invites())[0]
    await endpoints.acceptInvite('pt_cl')

    setTokens(await endpoints.login({ handle: '@minho', password: 'point' }))
    await endpoints.removeMember('pt_cl', 'u_jisu')
    const again = await endpoints.createInvite('pt_cl', 'u_jisu', key())
    expect(again.id).not.toBe(first.id)
  })
})

describe('membership 을 서버가 싣는다', () => {
  it('공개 은행에는 회원 개념이 없다 — null 이다', async () => {
    const open = await endpoints.pointType('pt_on')
    expect(open.membership).toBeNull()
  })

  it('회원 · 초대받은 사람 · 나온 사람이 셋으로 갈린다', async () => {
    expect((await endpoints.pointType('pt_cl')).membership).toBe('member')

    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))
    expect((await endpoints.pointType('pt_cl')).membership).toBe('invited')

    await endpoints.acceptInvite('pt_cl')
    expect((await endpoints.pointType('pt_cl')).membership).toBe('member')

    // 나온 사람에게 은행 페이지가 보이려면 잔액이 남아 있어야 한다 — 잔액 행이
    // 이미 닿았다는 증거다. 계약: docs/API.md 「회원 자격」
    setTokens(await endpoints.login({ handle: '@minho', password: 'point' }))
    await endpoints.createTransfer({ pointTypeId: 'pt_cl', toId: 'u_jisu', amount: 100 }, key())

    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))
    await endpoints.leaveBank('pt_cl')
    expect((await endpoints.pointType('pt_cl')).membership).toBe('outsider')
  })
})

/*
 * **담는 기준은 잔액이 아니라 관계다** — 계약: docs/API.md.
 *
 * 초대를 수락한 사람은 처음엔 잔액이 0 이고, 수락이 초대를 소진시키므로 들어온
 * 문마저 닫힌다. 걸러 내면 가입은 됐는데 그 은행이 어느 화면에도 없다.
 */
describe('지갑은 관계로 담는다', () => {
  it('회원이면 잔액 0 이어도 담긴다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))

    const before = (await endpoints.wallet()).balances.find((b) => b.pointType.id === 'pt_cl')
    expect(before, '초대만 받은 상태에서는 담기지 않는다').toBeUndefined()

    await endpoints.acceptInvite('pt_cl')
    const after = (await endpoints.wallet()).balances.find((b) => b.pointType.id === 'pt_cl')
    expect(after).toMatchObject({ amount: 0, sendable: 0 })
    expect(after?.pointType.membership).toBe('member')
  })

  it('나가면 다시 빠진다 — 잔액이 없으면 관계도 없다', async () => {
    await endpoints.createInvite('pt_cl', 'u_jisu', key())
    setTokens(await endpoints.login({ handle: '@jisu', password: 'point' }))
    await endpoints.acceptInvite('pt_cl')
    await endpoints.leaveBank('pt_cl')

    const held = (await endpoints.wallet()).balances.find((b) => b.pointType.id === 'pt_cl')
    expect(held).toBeUndefined()
  })

  // 잔액이 남으면 나가도 담긴다. 쓸 수 없을 뿐이다 — 계약: docs/API.md
  it('나가도 잔액이 남으면 담긴다. 보낼 수 있는 양만 0 이다', async () => {
    setTokens(await endpoints.login({ handle: '@jisoo', password: 'point' }))
    await endpoints.leaveBank('pt_cl')

    const held = (await endpoints.wallet()).balances.find((b) => b.pointType.id === 'pt_cl')
    expect(held).toMatchObject({ amount: 30_000, sendable: 0 })
    expect(held?.pointType.membership).toBe('outsider')
  })
})

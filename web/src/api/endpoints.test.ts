import { beforeEach, describe, expect, it } from 'vitest'
import { endpoints } from './endpoints'
import { ApiError, newIdempotencyKey, setTokens } from './http'
import { balanceOf, SEED_ISSUER as ME } from '@/mocks/ledger'
import { expireAccessTokens } from '@/mocks/sessions'
import { setSim } from '@/mocks/sim'

/**
 * HTTP 계약 시나리오.
 *
 * 인메모리 객체를 부르지 않고 실제 `fetch` 를 한다. MSW 가 앱과 같은 핸들러로
 * 그것을 받으므로, 여기서 통과하는 것은 상태 코드와 헤더까지 포함한 계약이다.
 */
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
    expect(new Set(sameName.map((b) => b.pointType.issuerId)).size).toBe(2)
    expect(new Set(sameName.map((b) => b.pointType.symbol)).size).toBe(2)
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

  it('이름 검색은 동명이인을 모두 준다 — 화면이 구별을 책임진다', async () => {
    const found = await endpoints.users('김지수')
    expect(found.map((u) => u.handle).sort()).toEqual(['@jisoo', '@jisu'])
  })

  // 결과 안에서만 겹침을 세면 여기서 동명이인 방어가 꺼진다.
  it('핸들로 검색해 한 명만 맞아도 동명이인을 함께 준다', async () => {
    const found = await endpoints.users('@jisu')
    expect(found.map((u) => u.handle).sort()).toEqual(['@jisoo', '@jisu'])
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
    expect(transfer.confirmedAt).toBeTruthy()
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
  it('무에서 만들어 내 지갑으로 들어오고 총 유통량이 늘어난다', async () => {
    const before = balanceOf('pt_gm', ME)
    const issued = await endpoints.createIssue({ pointTypeId: 'pt_gm', amount: 100_000 }, key())
    expect(issued.fromId).toBeNull()
    expect(issued.kind).toBe('issue')
    expect(issued.toId).toBe(ME)
    expect(balanceOf('pt_gm', ME)).toBe(before + 100_000)

    const types = await endpoints.pointTypes()
    expect(types.find((t) => t.id === 'pt_gm')?.totalIssued).toBe(1_300_000)
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
  const bakery = { name: '동네빵집', symbol: 'BK', accent: 'orange' as const, issueCap: 1_000_000 }

  it('만든 사람이 발행자이고 유통량은 0 에서 시작한다', async () => {
    const created = await endpoints.createPointType(bakery, key())
    expect(created).toMatchObject({
      name: '동네빵집',
      symbol: 'BK',
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

  it('기호가 겹치면 409 다 — 판정은 서버만 한다', async () => {
    await expect(
      endpoints.createPointType({ ...bakery, symbol: 'ON' }, key()),
    ).rejects.toMatchObject({ code: 'SYMBOL_TAKEN', status: 409 })
  })

  it('대소문자가 달라도 같은 기호다', async () => {
    await expect(
      endpoints.createPointType({ ...bakery, symbol: 'on' }, key()),
    ).rejects.toMatchObject({ code: 'SYMBOL_TAKEN' })
  })

  // 창설도 되돌릴 수 없다. 응답을 못 받고 다시 눌러도 하나만 생겨야 한다.
  it('같은 키로 두 번 보내면 하나만 생긴다', async () => {
    const k = key()
    const first = await endpoints.createPointType({ ...bakery, symbol: 'BX' }, k)
    const second = await endpoints.createPointType({ ...bakery, symbol: 'BX' }, k)
    expect(second.id).toBe(first.id)
    const types = await endpoints.pointTypes()
    expect(types.filter((t) => t.symbol === 'BX')).toHaveLength(1)
  })

  it.each([
    ['이름이 비었다', { name: '  ' }],
    ['이름이 13자다', { name: '가나다라마바사아자차카타파' }],
    ['기호가 네 자다', { symbol: 'ABCD' }],
    ['기호에 숫자가 있다', { symbol: 'B1' }],
    ['상한이 소수다', { issueCap: 1.5 }],
    ['상한이 0 이다', { issueCap: 0 }],
    ['없는 색이다', { accent: 'crimson' as never }],
  ])('%s 면 400 이다', async (_label, patch) => {
    await expect(
      endpoints.createPointType({ ...bakery, symbol: 'ZZ', ...patch }, key()),
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

describe('결과를 알 수 없는 실패', () => {
  it('네트워크 실패는 전송 자체가 실패한다', async () => {
    setSim({ forceFailure: 'NETWORK' })
    const error = await endpoints.me().catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'NETWORK', status: null, outcomeUnknown: true })
  })

  it('서버 오류도 결과를 알 수 없다', async () => {
    setSim({ forceFailure: 'SERVER' })
    await expect(endpoints.me()).rejects.toMatchObject({ code: 'SERVER', outcomeUnknown: true })
  })

  it('주입된 실패는 한 번만 쓰이고 소모된다', async () => {
    setSim({ forceFailure: 'NETWORK' })
    await expect(endpoints.me()).rejects.toBeInstanceOf(ApiError)
    await expect(endpoints.me()).resolves.toBeTruthy()
  })

  it('없는 이체를 조회하면 404 — 일어나지 않았다는 답이 된다', async () => {
    await expect(endpoints.transfer('t_nope')).rejects.toMatchObject({ status: 404 })
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
    await expect(endpoints.transfer(created.id)).resolves.toMatchObject({ id: created.id })
    await expect(endpoints.transferByKey(idempotencyKey)).resolves.toMatchObject({ id: created.id })
  })

  // 받은 쪽에게도 "돈이 어디 있는가" 를 답해야 한다 — docs/JOURNEY.md 여정 6
  it('받은 쪽도 읽는다', async () => {
    const created = await endpoints.createTransfer(
      { pointTypeId: 'pt_on', toId: 'u_jisoo', amount: 1_000 },
      key(),
    )
    await switchTo(OUTSIDER)
    await expect(endpoints.transfer(created.id)).resolves.toMatchObject({ id: created.id })
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
    expect(own.fromId).toBe('u_jisoo')
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
    await expect(endpoints.history()).resolves.toMatchObject([{ id: gm.id }, { id: on.id }])
    await expect(endpoints.history({ pointTypeId: 'pt_on' })).resolves.toMatchObject([
      { id: on.id },
    ])
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

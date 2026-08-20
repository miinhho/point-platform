import { describe, expect, it } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError } from './http'
import { read } from './read'

/**
 * 스무 곳이 이 함수 하나에 기댄다. **그러면 이 함수가 약해질 때 스무 곳이 한꺼번에
 * 약해진다.** 화면 테스트가 두 경로에서 잡아 주지만 그것은 이 함수를 시험하는 것이
 * 아니라 그 경로를 시험하는 것이다.
 *
 * 순수 함수라 화면을 띄울 필요가 없다.
 */
const query = <T,>(state: Partial<UseQueryResult<T>>): UseQueryResult<T> =>
  ({ isPending: false, isError: false, data: undefined, error: null, refetch: () => {}, ...state }) as UseQueryResult<T>

const notFound = new ApiError('POINT_TYPE_NOT_FOUND', '', 404, 'none')
const serverDown = new ApiError('SERVER', '', 500, 'none')

describe('read', () => {
  it('성공하면 그대로 준다', () => {
    expect(read(query({ data: '값' }))).toMatchObject({
      pending: false, failed: false, absent: false, data: '값',
    })
  })

  it('아직 모르면 답이 없다', () => {
    expect(read(query({ isPending: true }))).toMatchObject({
      pending: true, failed: false, absent: false, data: null,
    })
  })

  /*
   * **`data ?? null` 과 갈리는 유일한 경우다.** 한 번 성공해 캐시에 있고 그 뒤
   * 재조회가 실패했을 때 — TanStack 이 마지막 성공을 버리지 않는다.
   * 첫 조회부터 실패하면 `data` 가 어차피 없어서 두 구현이 같은 답을 낸다.
   */
  it('재조회가 실패하면 낡은 성공을 주지 않는다', () => {
    const stale = read(query({ isError: true, error: serverDown, data: '옛것' }))
    expect(stale.data).toBeNull()
    expect(stale.failed).toBe(true)
  })

  // 404 는 답이다. 다시 해도 같으므로 「모르겠다」와 함께 서지 않는다
  it('404 는 답이고, 답이면 실패가 아니다', () => {
    const gone = read(query({ isError: true, error: notFound, data: '옛것' }))
    expect(gone).toMatchObject({ absent: true, failed: false, data: null })
  })

  it('그 밖의 실패는 답이 아니다', () => {
    expect(read(query({ isError: true, error: serverDown }))).toMatchObject({
      absent: false, failed: true,
    })
  })

  // 네트워크 실패는 status 가 없다. 그것을 답으로 읽으면 「모르겠다」가 「없다」가 된다
  it('응답이 없는 실패도 답이 아니다', () => {
    const offline = new ApiError('NETWORK', '', null, 'unknown')
    expect(read(query({ isError: true, error: offline }))).toMatchObject({
      absent: false, failed: true,
    })
  })
})

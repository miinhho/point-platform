import { describe, expect, it } from 'vitest'
import { FAILURE_CODES } from '@/shared/contract'
// 원문으로 가져온다. `node:fs` 를 쓰면 이 파일만 다른 tsconfig 로 넘어가고,
// 그러면 `FAILURE_CODES` 를 실제로 import 하지 못해 문자열을 파싱하게 된다.
import apiDoc from '../../../docs/API.md?raw'

/**
 * 계약 문서와 클라이언트를 묶는다.
 *
 * 사슬이 이랬다 — 서버 enum ⊆ 문서 표는 백엔드가 테스트로 묶었고, `FAILURE_CODES` ⊆
 * Mock 상태표·문구는 타입과 `copy.test.ts` 가 묶는다. **가운데가 비어 있었다.**
 *
 * 그 사이가 끊기면 이렇게 된다: 백엔드가 새 코드를 서버에 더한다 → 이미 문서 표에
 * 있으므로 서버 테스트는 통과한다 → 그런데 `FAILURE_CODES` 에 없으면 `http.ts` 의
 * `KNOWN_CODES` 가 못 알아보고 **`SERVER` 로 떨어뜨린다.** 「이미 그 은행의 회원이에요」가
 * 「서버에 문제가 생겼어요」로 뜨고, 사용자는 자기가 아무것도 잘못하지 않았는데 앱이
 * 고장났다고 읽는다. 그리고 웹 테스트도 서버 테스트도 전부 통과한다.
 *
 * 정규식은 서버 쪽 `FailureCodeContractTest` 와 같은 것을 쓴다 — 한쪽만 고치면 어긋난다.
 */
function codesInFailureTable(): string[] {
  const section = /^## 실패\s*$([\s\S]*?)(?=^## )/m.exec(apiDoc)
  // 파싱이 깨졌는데 조용히 빈 집합을 비교하면 이 테스트가 아무것도 안 하게 된다.
  if (!section) throw new Error('docs/API.md 에서 「## 실패」 절을 찾지 못했다')

  const codes = [...section[1].matchAll(/^\| `([A-Z_]+)` \|/gm)].map(([, code]) => code)
  if (codes.length < 10) throw new Error(`실패 표를 읽지 못했다 — ${codes.length}개만 나왔다`)
  return codes
}

describe('실패 코드는 계약 표와 같다', () => {
  /*
   * 덮기만 하는 것이 아니라 **같아야** 한다. `NETWORK` 은 서버에 대응물이 없지만 표에
   * 있으므로 방향을 한쪽으로 열어 둘 이유가 없고, 열어 두면 화면에 도달할 수 없는 코드가
   * 조용히 쌓인다.
   */
  it('문서 표와 FAILURE_CODES 가 정확히 일치한다', () => {
    expect([...FAILURE_CODES].sort()).toEqual([...new Set(codesInFailureTable())].sort())
  })

  it('표에 같은 코드가 두 번 오지 않는다', () => {
    const codes = codesInFailureTable()
    expect(codes).toHaveLength(new Set(codes).size)
  })
})

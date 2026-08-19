import { describe, expect, it } from 'vitest'
import { ko } from './ko'
import { FAILURE_CODES, type FailureCode } from '@/api/contract'

/**
 * 문구 규칙.
 *
 * 1차 구현에서 두 가지가 눈으로만 검사됐고 둘 다 실패했다 — 문체가 번역체로 흘렀고,
 * 발행 화면이 "잔액"이라는 말을 썼다. 문자열을 카탈로그로 모은 첫 번째 이유가
 * 이 규칙들을 테스트로 옮기는 것이다.
 */
type Entry = { path: string; text: string }

function flatten(value: unknown, prefix = ''): Entry[] {
  if (typeof value === 'string') return [{ path: prefix, text: value }]
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    )
  }
  return []
}

const ALL = flatten(ko)

/**
 * 실패 화면(여정 6)에 도달하는 코드만 「돈이 어디 있는가」를 말한다.
 * 인증 실패는 로그인 화면으로 가고, 기호 겹침과 상한 미달은 각자의 화면 안에서 뜬다.
 */
const NOT_ON_FAILURE_SCREEN: FailureCode[] = [
  'BAD_CREDENTIALS',
  'UNAUTHENTICATED',
  'SYMBOL_TAKEN',
  'CAP_BELOW_ISSUED',
  'MALFORMED_REQUEST',
  'TRANSFER_NOT_FOUND',
  'ISSUER_CANNOT_LEAVE',
  'NOT_A_PRIVATE_BANK',
]


const ON_FAILURE_SCREEN = FAILURE_CODES.filter((code) => !NOT_ON_FAILURE_SCREEN.includes(code))

describe('문체', () => {
  // 이 테스트가 없어서 "아직 아무것도 처리되지 않았다" 가 앱 전체에 퍼졌다.
  it('평서형 종결(~다)로 끝나지 않는다', () => {
    const offenders = ALL.filter(({ text }) => /(?:다|다\.)$/.test(text))
    expect(offenders.map((e) => `${e.path}: ${e.text}`)).toEqual([])
  })

  it('문어체 어미를 쓰지 않는다', () => {
    const offenders = ALL.filter(({ text }) => /(한다|된다|않는다|이다|아니다)/.test(text))
    expect(offenders.map((e) => `${e.path}: ${e.text}`)).toEqual([])
  })

  it('비어 있는 문구가 없다', () => {
    expect(ALL.filter(({ text }) => text.trim() === '').map((e) => e.path)).toEqual([])
  })

  // 긴 경고는 읽히지 않고, 읽히지 않는 경고는 없는 것과 같다.
  it('한 문구가 60자를 넘지 않는다', () => {
    const long = ALL.filter(({ text }) => text.length > 60)
    expect(long.map((e) => `${e.path}(${e.text.length}자)`)).toEqual([])
  })
})

describe('이체와 발행은 다른 말을 쓴다', () => {
  // 실제로 났던 버그다. 발행 중 화면이 "지금 취소하면 잔액은 그대로다" 라고 말했다.
  it('발행 문구에 "잔액"이 나오지 않는다', () => {
    const offenders = ALL.filter(
      ({ path, text }) => /Issue|issue/.test(path) && text.includes('잔액'),
    )
    expect(offenders.map((e) => `${e.path}: ${e.text}`)).toEqual([])
  })

  it('이체 문구에 "유통량"이 나오지 않는다', () => {
    const offenders = ALL.filter(
      ({ path, text }) => /Transfer|transfer/.test(path) && text.includes('유통량'),
    )
    expect(offenders.map((e) => `${e.path}: ${e.text}`)).toEqual([])
  })
})

describe('실패 문구', () => {
  // 코드를 늘리고 문구를 빠뜨리면 화면이 키를 그대로 뿌린다.
  it('모든 실패 코드가 제목을 가진다', () => {
    for (const code of FAILURE_CODES) expect(ko.failure[code].title, code).toBeTruthy()
  })

  it('실패 화면에 오는 코드는 이체·발행 두 문구를 가진다', () => {
    for (const code of ON_FAILURE_SCREEN) {
      const entry = ko.failure[code]
      expect('whereTransfer' in entry && entry.whereTransfer, code).toBeTruthy()
      expect('whereIssue' in entry && entry.whereIssue, code).toBeTruthy()
    }
  })

  // 화면이 가장 크게 말해야 하는 것이 "돈이 어디 있는가" 다.
  it('결과를 아는 실패는 아무것도 움직이지 않았다고 단정한다', () => {
    for (const code of ['INSUFFICIENT_BALANCE', 'RECIPIENT_NOT_FOUND'] as const) {
      expect(ko.failure[code].whereTransfer).toContain('나가지 않았어요')
    }
  })

  it('결과를 모르는 실패는 단정하지 않고 재시도가 안전한 이유를 말한다', () => {
    for (const code of ['NETWORK', 'SERVER'] as const) {
      expect(ko.failure[code].whereTransfer).toContain('알 수 없어요')
      expect(ko.failure[code].whereTransfer).toContain('두 번')
      expect(ko.failure[code].whereIssue).toContain('알 수 없어요')
    }
  })
})

describe('보간', () => {
  it('중괄호 자리표시자가 짝을 맞춘다', () => {
    for (const { path, text } of ALL) {
      const open = (text.match(/\{\{/g) ?? []).length
      const close = (text.match(/\}\}/g) ?? []).length
      expect(open, path).toBe(close)
    }
  })
})

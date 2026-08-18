import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 규칙: CLAUDE.md 「디자인은 토큰 이름만 쓴다」 · 「문자열은 i18next 키로 둔다」
 *
 * oxlint 로는 JSX 프롭 값의 의미를 판정할 수 없어서 테스트로 강제한다.
 */
const SCREEN_DIRS = ['src/features', 'src/app']

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path))
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(path)
  }
  return out
}

const FILES = SCREEN_DIRS.flatMap(tsxFiles)

/** 주석과 i18n 키 정의를 뺀 본문 */
/**
 * 주석을 지운 본문. `discipline-allow` 가 붙은 줄은 다음 줄까지 함께 지운다 —
 * 예외를 인정하되 그 자리에 이유를 적게 만든다.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/ discipline-allow:.*\n.*$/gm, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('화면 규율', () => {
  it('검사할 화면이 있다', () => {
    expect(FILES.length).toBeGreaterThan(0)
  })

  // 문체를 한 번에 고칠 수 없게 만드는 것이 하드코딩이다.
  it('한국어 리터럴이 없다 — 전부 i18next 키다', () => {
    const offenders = FILES.flatMap((path) =>
      [...code(path).matchAll(/['"`>][^'"`<>]*[가-힣][^'"`<>]*['"`<]/g)].map(
        (m) => `${path}: ${m[0].slice(0, 40)}`,
      ),
    )
    expect(offenders).toEqual([])
  })

  // 토큰이 있는데 화면이 안 쓰면 토큰이 없는 것보다 나쁘다.
  it('크기·색을 직접 지정하지 않는다', () => {
    const banned = /\b(fontSize|fontWeight|minHeight|lineHeight|letterSpacing)=/
    const offenders = FILES.flatMap((path) =>
      code(path)
        .split('\n')
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => banned.test(line))
        .map(({ line, n }) => `${path}:${n} ${line.slice(0, 40)}`),
    )
    expect(offenders).toEqual([])
  })

  it('색은 시맨틱 토큰이나 colorPalette 로만 쓴다', () => {
    // `bg="blue.500"` 처럼 **수치 스케일**을 직접 부르는 것만 막는다.
    // `red.fg` 같은 시맨틱 슬롯(fg·solid·subtle·muted·contrast·emphasized)은 정상이다.
    const raw = /(?:bg|color|borderColor)="[a-z]+\.\d{2,3}"/
    const offenders = FILES.flatMap((path) =>
      code(path)
        .split('\n')
        .filter((line) => raw.test(line))
        .map((line) => `${path}: ${line.trim().slice(0, 40)}`),
    )
    expect(offenders).toEqual([])
  })
})

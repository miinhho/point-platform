import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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

/** 배럴을 통과하는 것은 사용이 아니다 — 아무도 안 쓰는 것도 배럴에는 실린다 */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.') && entry !== 'index.ts') {
      out.push(path)
    }
  }
  return out
}

/** feature 소스 전부. 배럴은 뺀다 — 배럴이 자기 안을 가리키는 것은 정상이다 */
const FEATURE_SOURCES = sourceFiles('src/features')

describe('상태 규율', () => {
  // T1 이 호출부 0개인 쿼리 6개를 만들었고, 그 뒤 atom 하나가 또 그랬다 — CLAUDE.md F3
  it('export 된 atom 과 query 는 쓰는 곳이 있다', () => {
    const files = sourceFiles('src')
    const bodies = new Map(files.map((path) => [path, readFileSync(path, 'utf8')]))

    const orphans: string[] = []
    for (const [path, body] of bodies) {
      for (const [, name] of body.matchAll(/export const (\w+(?:Atom|Query))\b/g)) {
        const used = [...bodies].some(
          ([other, text]) => other !== path && new RegExp(`\\b${name}\\b`).test(text),
        )
        if (!used) orphans.push(`${path}: ${name}`)
      }
    }
    expect(orphans).toEqual([])
  })
})

/**
 * feature 안의 세 자리 — 규칙: CLAUDE.md 「계층이 아니라 기능으로 나눈다」
 *
 * `pages/` 사용자가 닿는 화면 하나 · `ui/` 그 화면을 이루는 조각 ·
 * `model/` 화면이 쓸 데이터를 가져오고 가공하는 곳.
 *
 * 셋이 이름만 남고 섞이는 것은 조용히 일어난다. 섞였을 때 실제로 무엇이
 * 나빠지는지가 있는 것만 검사한다.
 */
describe('feature 안의 세 자리', () => {
  const FEATURES = readdirSync('src/features').filter((name) =>
    statSync(join('src/features', name)).isDirectory(),
  )

  it('검사할 feature 가 있다', () => {
    expect(FEATURES.length).toBeGreaterThan(0)
  })

  // 조각을 내보내면 다른 feature 가 그것을 쓰고, 그때부터 그 조각은 자기 화면을
  // 따라 못 바뀐다. 공용으로 쓸 것이면 `shared/ui` 로 올라가야 한다.
  it('배럴은 조각(ui/)을 내보내지 않는다', () => {
    const offenders = FEATURES.filter((name) => {
      const barrel = join('src/features', name, 'index.ts')
      return existsSync(barrel) && readFileSync(barrel, 'utf8').includes('./ui/')
    })
    expect(offenders).toEqual([])
  })

  // 조각이 화면을 부르면 방향이 뒤집힌 것이다 — 그것은 더 이상 조각이 아니다.
  it('조각이 화면을 수입하지 않는다', () => {
    const offenders = FEATURES.flatMap((name) => {
      const dir = join('src/features', name, 'ui')
      return existsSync(dir)
        ? sourceFiles(dir).filter((path) => readFileSync(path, 'utf8').includes("from '../pages/"))
        : []
    })
    expect(offenders).toEqual([])
  })

  // ViewModel 이 뷰를 만들면 나눈 의미가 없다. 확장자로 막는다.
  it('model 은 JSX 를 갖지 않는다', () => {
    const offenders = FEATURES.flatMap((name) => {
      const dir = join('src/features', name, 'model')
      return existsSync(dir) ? readdirSync(dir).filter((entry) => entry.endsWith('.tsx')) : []
    })
    expect(offenders).toEqual([])
  })

  /*
   * 내부 경로가 새면 그 파일은 옮길 수 없게 되고, 옮길 수 없는 파일이 생기는
   * 순간 구조가 아니라 관습이 된다.
   */
  it('feature 밖에서는 배럴만 본다', () => {
    const outside = [...sourceFiles('src/app'), ...sourceFiles('src/shared'), ...FEATURE_SOURCES]
    const offenders = outside.flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/from '(@\/features\/[a-z]+\/[^']+)'/g)].map(
        ([, spec]) => `${path}: ${spec}`,
      ),
    )
    expect(offenders).toEqual([])
  })
})

describe('상태는 공용 recipe 가 갖는다', () => {
  /*
   * 화면마다 `_hover` 를 적기 시작하면 곧 어떤 화면만 반응하는 상태가 된다.
   * 사용자 지적: 「커서를 가져가도 색이 안 바뀐다」
   */
  it('feature 안에서 커서 상태를 직접 정하지 않는다', () => {
    const offenders = FILES.filter((path) => path.includes('/features/')).filter((path) =>
      /_hover|_focusVisible/.test(code(path)),
    )
    expect(offenders).toEqual([])
  })

  it('누를 수 있는 공용 요소가 세 상태를 갖는다', () => {
    const shared = readFileSync('src/shared/ui/Screen.tsx', 'utf8')
    for (const state of ['_hover', '_active', '_focusVisible']) {
      expect(shared, state).toContain(state)
    }
    // 커서 상태는 커서가 있는 기기에서만. 터치에서는 탭한 자리에 눌러붙는다.
    expect(shared).toContain('(hover: hover)')
  })
})

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

  /*
   * 여백은 이 앱에서 가장 많이 손으로 고르던 값이다. 같은 뜻의 사이가 화면마다
   * 다르면 그것이 화면을 제각각으로 보이게 한다 — 토큰 이름은 `system.ts` 에 있다.
   */
  it('여백을 수치로 지정하지 않는다', () => {
    const raw = /\b(margin|padding|gap)[A-Za-z]*="[\d.]+"/
    const offenders = FILES.flatMap((path) =>
      code(path)
        .split('\n')
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => raw.test(line))
        .map(({ line, n }) => `${path}:${n} ${line.slice(0, 48)}`),
    )
    expect(offenders).toEqual([])
  })

  // `l1`·`l2`·`l3` 는 Chakra 의 것이다. 우리 것이 아니면 우리가 못 바꾼다.
  it('모서리는 우리 토큰으로만 쓴다', () => {
    const offenders = FILES.flatMap((path) =>
      code(path)
        .split('\n')
        .filter((line) => /borderRadius="(l\d|[\d.]+(px|rem))"/.test(line))
        .map((line) => `${path}: ${line.trim().slice(0, 48)}`),
    )
    expect(offenders).toEqual([])
  })

  /*
   * `red.fg` 는 「빨강」이라고 적혀 있지 「상한을 넘었다」라고 적혀 있지 않다.
   * 뜻이 이름에 없으면 나중에 한쪽만 바꿀 수 없다 — 의도 토큰이 `system.ts` 에 있다.
   */
  it('뜻 없는 팔레트 색을 화면이 직접 부르지 않는다', () => {
    const raw = /(?:bg|color|borderColor)="(?:red|green|orange|blue|teal|gray|pink|purple)\./
    const offenders = FILES.flatMap((path) =>
      code(path)
        .split('\n')
        .filter((line) => raw.test(line))
        .map((line) => `${path}: ${line.trim().slice(0, 48)}`),
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

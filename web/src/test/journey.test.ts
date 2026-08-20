import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 여정 문서와 코드가 어긋나지 않는지.
 *
 * `docs/JOURNEY.md` 의 확인 방법 중 파일 수준에서 판정 가능한 것들이다.
 */
function files(dir: string, ext: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...files(path, ext))
    else if (entry.endsWith(ext)) out.push(path)
  }
  return out
}

const SOURCE = [...files('src', '.ts'), ...files('src', '.tsx')].filter(
  (path) => !path.includes('.test.'),
)

const read = (path: string) => readFileSync(path, 'utf8')

describe('삭제된 개념이 되살아나지 않는다', () => {
  // 근거: docs/JOURNEY.md 「버린 것과 이유」
  const BURIED = ['cancelableUntil', 'NOT_CANCELLABLE', 'completedSteps', 'ProgressStep']

  it.each(BURIED)('%s 가 코드에 없다', (name) => {
    const found = SOURCE.filter((path) => read(path).includes(name))
    expect(found).toEqual([])
  })

  it('Transfer 에 status 필드가 없다', () => {
    expect(read('src/shared/contract/transfer.ts')).not.toMatch(/status:\s*TransferStatus/)
  })
})

describe('멱등성 키는 헤더다', () => {
  it('본문 필드로 보내지 않는다', () => {
    expect(read('src/shared/api/http.ts')).toContain("'Idempotency-Key'")
    // 파일 이름을 박지 않는다 — 엔티티가 늘면 그 파일만 검사를 빠져나간다.
    for (const path of files('src/shared/api', '.ts')) {
      expect(read(path), path).not.toMatch(/body:\s*\{[^}]*idempotencyKey/)
    }
  })
})

describe('발행은 대상을 받지 않는다', () => {
  it('CreateIssueInput 에 toId 가 없다', () => {
    const types = read('src/shared/api/issues.ts')
    const block = types.slice(types.indexOf('CreateIssueInput'), types.indexOf('export const issuesApi'))
    expect(block).not.toContain('toId')
  })
})

describe('발행을 색으로 구분하지 않는다', () => {
  // 색은 포인트의 것이다. 발행에 또 쓰면 두 신호가 같은 채널에서 다툰다.
  it('issue 라는 색 토큰이 없다', () => {
    expect(read('src/shared/ui/system.ts')).not.toMatch(/issue:\s*\{[^}]*colors\./)
  })
})

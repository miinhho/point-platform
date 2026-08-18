import { describe, expect, it } from 'vitest'
import { system } from './system'

/**
 * 포커스 링이 배경과 3:1 이상인지 (WCAG 1.4.11 Non-text Contrast).
 *
 * Chakra 기본값은 밝은 모드에서 미달이었고, 화면을 눈으로 봐서는 알 수 없다.
 * 팔레트를 늘리거나 Chakra 를 올릴 때 조용히 되돌아가지 않게 여기서 잡는다.
 */

type Mode = '_light' | '_dark'

/** `{colors.gray.600}` 같은 참조를 따라가 최종 색 문자열을 얻는다. */
function resolve(name: string, mode: Mode): string {
  const token = system.tokens.getByName(name)
  if (!token) throw new Error(`토큰 없음: ${name}`)
  const conditions = token.extensions.conditions as Record<string, string> | undefined
  const raw = conditions?.[mode] ?? (token.originalValue as string) ?? ''
  const reference = /^\{(.+)\}$/.exec(raw)
  return reference ? resolve(reference[1], mode) : raw
}

function rgb(color: string): [number, number, number] {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color)
  if (short) return [short[1], short[2], short[3]].map((c) => parseInt(c + c, 16)) as [number, number, number]
  const long = /^#([0-9a-f]{6})$/i.exec(color)
  if (long) {
    const n = parseInt(long[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  if (color === 'white') return [255, 255, 255]
  if (color === 'black') return [0, 0, 0]
  throw new Error(`색을 읽을 수 없다: ${color}`)
}

function ratio(a: string, b: string): number {
  const luminance = (color: string) => {
    const [r, g, bl] = rgb(color).map((v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 화면에 실제로 나타나는 팔레트 — 포인트 6색 + 기본 + 실패 */
const PALETTES = ['gray', 'red', 'blue', 'green', 'purple', 'orange', 'pink', 'teal']
const MODES: Mode[] = ['_light', '_dark']

describe('포커스 링 대비', () => {
  it.each(MODES.flatMap((mode) => PALETTES.map((palette) => [palette, mode] as const)))(
    '%s / %s 가 배경과 3:1 이상이다',
    (palette, mode) => {
      const value = ratio(resolve(`colors.${palette}.focusRing`, mode), resolve('colors.bg', mode))
      expect(value).toBeGreaterThanOrEqual(3)
    },
  )
})

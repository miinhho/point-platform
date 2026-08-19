import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// 규칙: CLAUDE.md 「디자인은 토큰 이름만 쓴다」

/**
 * 포커스 링. Chakra 기본값은 밝은 모드에서 배경 대비 3:1(WCAG 1.4.11)에 미달한다 —
 * gray 2.56 · green 2.28 · teal 2.49 · orange 2.80. 모드별로 한 단계씩 옮긴다.
 */

/**
 * Chakra 에 없는 포인트 색. 여섯으로는 만드는 사람이 고를 것이 금방 떨어진다 —
 * 색으로 무엇을 가르지 않으므로(발행자 핸들과 이모지가 그 일을 한다) 늘려도 된다.
 * 대비는 `contrast.test.ts` 가 라이트·다크 둘 다 잰다.
 */
const ADDED = {
  amber: ['#fffbeb','#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706','#b45309','#92400e','#78350f','#451a03'],
  rose: ['#fff1f2','#ffe4e6','#fecdd3','#fda4af','#fb7185','#f43f5e','#e11d48','#be123c','#9f1239','#881337','#4c0519'],
  indigo: ['#eef2ff','#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca','#3730a3','#312e81','#1e1b4b'],
  lime: ['#f7fee7','#ecfccb','#d9f99d','#bef264','#a3e635','#84cc16','#65a30d','#4d7c0f','#3f6212','#365314','#1a2e05'],
} as const

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** 밝은 색 위의 글자는 검정이어야 읽힌다 — 흰 글자는 4.5:1 에 못 미친다 */
const DARK_TEXT: readonly string[] = ['amber', 'lime']

const addedScales = Object.fromEntries(
  Object.entries(ADDED).map(([name, ramp]) => [
    name,
    Object.fromEntries(STEPS.map((step, index) => [step, { value: ramp[index] }])),
  ]),
)

/** Chakra 가 팔레트마다 요구하는 슬롯. 기본 팔레트의 정의를 그대로 따른다 */
const addedSemantics = Object.fromEntries(
  Object.keys(ADDED).map((name) => [
    name,
    {
      contrast: { value: DARK_TEXT.includes(name) ? 'black' : 'white' },
      fg: { value: { _light: `{colors.${name}.700}`, _dark: `{colors.${name}.300}` } },
      subtle: { value: { _light: `{colors.${name}.100}`, _dark: `{colors.${name}.900}` } },
      muted: { value: { _light: `{colors.${name}.200}`, _dark: `{colors.${name}.800}` } },
      emphasized: { value: { _light: `{colors.${name}.300}`, _dark: `{colors.${name}.700}` } },
      solid: { value: `{colors.${name}.600}` },
      border: { value: { _light: `{colors.${name}.500}`, _dark: `{colors.${name}.400}` } },
    },
  ]),
)

const focusRings = Object.fromEntries(
  ['gray', 'red', 'blue', 'green', 'purple', 'orange', 'pink', 'teal', ...Object.keys(ADDED)].map((palette) => [
    palette,
    { focusRing: { value: { _light: `{colors.${palette}.600}`, _dark: `{colors.${palette}.400}` } } },
  ]),
)

const config = defineConfig({
  theme: {
    tokens: {
      spacing: {
        /** 화면 좌우 여백. 모든 화면이 같은 값을 쓴다 */
        gutter: { value: '20px' },
      },
      colors: addedScales,
      sizes: {
        /** 목록의 원형 표식 */
        avatar: { value: '42px' },
        /** 누르는 것의 높이. 버튼·입력이 전부 이 하나를 쓴다 */
        control: { value: '52px' },
        /** 키패드 키 */
        key: { value: '60px' },
      },
    },

    semanticTokens: {
      colors: {
        ...addedSemantics,
        ...focusRings,
        /** 확정되지 않은 것. 완료와 같은 색일 수 없다. */
        pending: {
          fg: { value: { base: '{colors.gray.500}', _dark: '{colors.gray.400}' } },
          subtle: { value: { base: '{colors.gray.100}', _dark: '{colors.gray.900}' } },
        },
        /** 검증해야 하는 것. 색만으로 구분하지 않으므로 크기·굵기와 함께 쓴다. */
        verify: {
          fg: { value: { base: '{colors.orange.700}', _dark: '{colors.orange.300}' } },
          subtle: { value: { base: '{colors.orange.50}', _dark: '{colors.orange.950}' } },
        },
      },
    },

    textStyles: {
      /** 화면 제목 */
      title: { value: { fontSize: 'md', fontWeight: 'semibold', letterSpacing: '-0.01em' } },
      /** 포인트 이름 */
      name: { value: { fontSize: 'lg', fontWeight: 'medium', letterSpacing: '-0.01em' } },
      /** 잔액 */
      balance: {
        value: {
          fontSize: '2xl',
          fontWeight: 'bold',
          lineHeight: '1.2',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      /** 금액. 크기는 `amountFit` 이 자릿수로 정한다 */
      amount: {
        value: {
          fontWeight: 'bold',
          lineHeight: '1.15',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      /** 검증하라는 안내. 색만이 아니라 굵기도 함께 올린다 */
      verifyLabel: { value: { fontSize: 'xs', fontWeight: 'medium', color: 'verify.fg' } },
      /** 섹션 라벨, 포인트 이름 */
      label: { value: { fontSize: 'sm', fontWeight: 'medium' } },
      /** 보조 설명, 한글 병기 */
      support: { value: { fontSize: 'md', fontWeight: 'normal', color: 'fg.muted' } },
      /** 핸들. 색을 여기서 정한다 — 화면마다 붙이면 한 화면에서만 흐려진다 */
      handle: { value: { fontSize: 'sm', fontWeight: 'normal', color: 'fg.muted' } },
      /** 이름이 겹칠 때의 핸들. 크기·굵기를 함께 올린다 */
      handleVerify: { value: { fontSize: 'md', fontWeight: 'medium' } },
      /** 키패드 숫자 */
      key: { value: { fontSize: '2xl', fontWeight: 'medium', fontVariantNumeric: 'tabular-nums' } },
      /** 키패드의 글자 키 */
      keyGlyph: { value: { fontSize: 'sm', fontWeight: 'medium' } },
      button: { value: { fontSize: 'md', fontWeight: 'medium' } },
      /** 표의 값 */
      line: { value: { fontSize: 'sm', fontWeight: 'normal', fontVariantNumeric: 'tabular-nums' } },
      /** 표에서 가장 중요한 값 */
      lineStrong: {
        value: { fontSize: 'md', fontWeight: 'medium', fontVariantNumeric: 'tabular-nums' },
      },
      /** 결과 화면의 큰 한 줄 */
      headline: { value: { fontSize: 'xl', fontWeight: 'semibold', letterSpacing: '-0.01em' } },
      body: { value: { fontSize: 'md', fontWeight: 'normal' } },
      /** 사람이 대조하는 문자열 */
      mono: { value: { fontSize: 'sm', fontFamily: 'mono', wordBreak: 'break-all' } },
      /** 기호 배지 */
      badge: { value: { fontSize: 'xs', fontWeight: 'bold', letterSpacing: '0.02em' } },
      /** 가장 작은 것. 이보다 작은 글자를 만들지 않는다 */
      caption: { value: { fontSize: 'xs', fontWeight: 'normal', color: 'fg.muted' } },
    },

  },

  globalCss: {
    html: {
      // 더블탭 확대를 막는다. 모바일의 300ms 탭 지연도 함께 사라진다
      touchAction: 'manipulation',
      textSizeAdjust: '100%',
      height: '100%',
    },
    'body, #root': { height: '100%' },
    body: {
      bg: 'bg',
      // 오버스크롤 바운스
      overscrollBehavior: 'none',
      // 롱프레스 메뉴와 텍스트 선택. 네이티브 앱에서 본문이 선택되는 일은 없다
      WebkitTouchCallout: 'none',
      userSelect: 'none',
      // 탭 하이라이트. 눌림은 명시적으로 만든다
      WebkitTapHighlightColor: 'transparent',
    },
    // 입력은 예외다. 선택할 수 없는 입력은 고칠 수 없는 입력이다
    'input, textarea': { userSelect: 'text', WebkitUserSelect: 'text' },
    a: { color: 'inherit', textDecoration: 'none' },
  },
})

export const system = createSystem(defaultConfig, config)

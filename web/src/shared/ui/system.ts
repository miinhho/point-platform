import { createSystem, defaultConfig, defineConfig, defineRecipe } from '@chakra-ui/react'

// 규칙: CLAUDE.md 「디자인은 토큰 이름만 쓴다」
const actionButton = defineRecipe({
  className: 'action',
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5',
    width: '100%',
    minHeight: 'control',
    borderRadius: 'l2',
    textStyle: 'button',
    // 탭 하이라이트를 지웠으므로 눌림은 우리가 만든다
    transition: 'background 120ms',
    _disabled: { opacity: 0.35, cursor: 'default' },
  },
  variants: {
    tone: {
      primary: {
        bg: 'colorPalette.solid',
        color: 'colorPalette.contrast',
        _active: { bg: 'colorPalette.emphasized' },
      },
      secondary: {
        bg: 'bg.panel',
        color: 'fg',
        borderWidth: '1px',
        borderColor: 'border',
        _active: { bg: 'bg.muted' },
      },
      ghost: {
        bg: 'transparent',
        color: 'fg.muted',
        _active: { bg: 'bg.muted' },
      },
    },
  },
  defaultVariants: { tone: 'primary' },
})

/** 목록 한 줄. 홈의 포인트 카드, 대상 목록, 내역이 모두 이것이다 */
const listRow = defineRecipe({
  className: 'row',
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    width: '100%',
    textAlign: 'start',
    paddingBlock: '3',
    paddingInline: 'gutter',
    _active: { bg: 'bg.muted' },
  },
})

const surfaceCard = defineRecipe({
  className: 'card',
  base: {
    bg: 'bg.panel',
    borderRadius: 'l3',
    borderWidth: '1px',
    borderColor: 'border',
    padding: '5',
  },
})

const chip = defineRecipe({
  className: 'chip',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    paddingInline: '3',
    paddingBlock: '1.5',
    borderRadius: 'full',
    textStyle: 'label',
    borderWidth: '1px',
    borderColor: 'border',
    bg: 'transparent',
    color: 'fg.muted',
  },
  variants: {
    selected: {
      true: {
        borderColor: 'colorPalette.solid',
        bg: 'colorPalette.subtle',
        color: 'colorPalette.fg',
        fontWeight: 'medium',
      },
    },
  },
})

const config = defineConfig({
  theme: {
    tokens: {
      spacing: {
        /** 화면 좌우 여백. 모든 화면이 같은 값을 쓴다 */
        gutter: { value: '20px' },
      },
      sizes: {
        /** 누르는 것의 높이. 버튼·입력이 전부 이 하나를 쓴다 */
        control: { value: '52px' },
        /** 키패드 키. 실기기 실측에서 60px 이 오타 없이 눌렸다 */
        key: { value: '60px' },
        /** 목록의 원형 표식 */
        avatar: { value: '42px' },
      },
    },

    semanticTokens: {
      colors: {
        /** 아직 확정되지 않은 것. 완료(green)와 같은 색일 수 없다. */
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
      /** 금액. 자릿수에 따라 크기가 줄어드는 것은 `amountFit` 이 정한다 */
      amount: {
        value: {
          fontWeight: 'bold',
          lineHeight: '1.15',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      /** 카드 안의 잔액 */
      balance: {
        value: {
          fontSize: '2xl',
          fontWeight: 'bold',
          lineHeight: '1.2',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      /** 화면 제목 */
      title: { value: { fontSize: 'md', fontWeight: 'semibold', letterSpacing: '-0.01em' } },
      /** 결과 화면의 큰 한 줄 */
      headline: { value: { fontSize: 'xl', fontWeight: 'semibold', letterSpacing: '-0.01em' } },
      /** 사람 이름. 사용자가 검증하는 것이므로 핸들보다 크다 */
      name: { value: { fontSize: 'lg', fontWeight: 'medium', letterSpacing: '-0.01em' } },
      /** 핸들. 색을 여기서 함께 정한다 — 화면마다 붙이면 한 화면에서만 흐려진다 */
      handle: { value: { fontSize: 'sm', fontWeight: 'normal', color: 'fg.muted' } },
      body: { value: { fontSize: 'md', fontWeight: 'normal' } },
      /** 보조 설명 */
      support: { value: { fontSize: 'sm', fontWeight: 'normal', color: 'fg.muted' } },
      /** 섹션 라벨, 칩 */
      label: { value: { fontSize: 'sm', fontWeight: 'medium' } },
      /** 가장 작은 것. 이보다 작은 글자를 만들지 않는다 */
      caption: { value: { fontSize: 'xs', fontWeight: 'normal', color: 'fg.muted' } },
      button: { value: { fontSize: 'md', fontWeight: 'medium' } },
      /** 키패드 숫자 */
      key: { value: { fontSize: '2xl', fontWeight: 'medium', fontVariantNumeric: 'tabular-nums' } },
      /** 멱등성 키처럼 사람이 대조하는 문자열 */
      mono: { value: { fontSize: 'sm', fontFamily: 'mono', wordBreak: 'break-all' } },
    },

    recipes: { actionButton, listRow, surfaceCard, chip },
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

import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// 규칙: CLAUDE.md 「디자인은 토큰 이름만 쓴다」
const config = defineConfig({
  theme: {
    tokens: {
      spacing: {
        /** 화면 좌우 여백. 모든 화면이 같은 값을 쓴다 */
        gutter: { value: '20px' },
      },
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

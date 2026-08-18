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

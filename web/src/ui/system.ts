import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

/**
 * Chakra system.
 *
 * 색 스케일·타이포 스케일·간격 리듬은 Chakra 기본값을 쓴다. 검증된 값이고,
 * 우리가 임의로 고른 값보다 낫다. 여기에 더하는 것은 `docs/JOURNEY.md` 가
 * 규정한 *관계* 뿐이다.
 *
 *  - 여정 7: 발행은 이체와 시각적으로 결코 같지 않다 → issue 계열
 *  - 여정 5: 아직 확정되지 않은 것은 확정된 것과 달라 보여야 한다 → pending
 *  - 여정 2: 이름이 크고 핸들이 작다 → textStyles 의 위계
 *  - 플랫폼: WebView 임이 드러나는 흔적을 제거한다 → globalCss
 *
 * 금액 구간에 대응하는 색 토큰은 만들지 않는다. 위험도를 색으로 말하면
 * 색맹·저조도·야간 모드에서 그대로 사라진다.
 */
const config = defineConfig({
  theme: {
    tokens: {
      spacing: {
        /** 화면 좌우 여백. 모든 화면이 같은 값을 쓴다 (세로선이 어긋나면 전환이 흔들린다) */
        gutter: { value: '20px' },
      },
    },

    semanticTokens: {
      colors: {
        /**
         * 발행 (여정 7). 이체는 Chakra 기본 blue 를 쓰고, 발행은 purple 을 쓴다.
         * 두 색이 가까워지면 발행 화면에 실수로 들어와 있는 상태가 생긴다.
         */
        issue: {
          solid: { value: { base: '{colors.purple.600}', _dark: '{colors.purple.400}' } },
          contrast: { value: { base: 'white', _dark: '{colors.purple.950}' } },
          fg: { value: { base: '{colors.purple.700}', _dark: '{colors.purple.300}' } },
          subtle: { value: { base: '{colors.purple.50}', _dark: '{colors.purple.950}' } },
          border: { value: { base: '{colors.purple.300}', _dark: '{colors.purple.700}' } },
        },

        /**
         * 미확정 (여정 5). 서버가 확정하기 전의 상태는 완료와 같은 색일 수 없다.
         * 성공색(green)과 명확히 구분되는 중립색을 쓴다.
         */
        pending: {
          fg: { value: { base: '{colors.gray.500}', _dark: '{colors.gray.400}' } },
          subtle: { value: { base: '{colors.gray.100}', _dark: '{colors.gray.800}' } },
        },
      },
    },

    textStyles: {
      /** 금액. 자릿수가 흔들리면 롤링 애니메이션이 무너진다. */
      amount: {
        value: {
          fontSize: 'clamp(2.125rem, 11vw, 2.875rem)',
          fontWeight: 'bold',
          lineHeight: '1.15',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      amountSmall: {
        value: {
          fontSize: '2xl',
          fontWeight: 'bold',
          lineHeight: '1.2',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      /** 사람이 검증하는 것 (여정 2). 핸들보다 반드시 크다. */
      name: {
        value: {
          fontSize: 'lg',
          fontWeight: 'medium',
          letterSpacing: '-0.01em',
        },
      },
      /**
       * 계좌번호 역할. 이름보다 작다.
       *
       * 색을 여기서 함께 정한다. 화면마다 따로 붙였더니 금액 입력 헤더에서만
       * `fg.subtle` 이 되어, **동명이인을 고른 사용자가 금액을 치는 동안 누구를
       * 골랐는지 확인할 유일한 단서가 가장 흐려졌다** (실기기 대비 실측 2.56:1,
       * 다른 화면은 7.7:1). 작다는 것과 안 보인다는 것은 다르다.
       */
      handle: {
        value: {
          fontSize: 'sm',
          fontWeight: 'normal',
          color: 'fg.muted',
        },
      },
    },
  },

  globalCss: {
    html: {
      // 더블탭 확대를 막는다. 모바일의 300ms 탭 지연도 함께 사라진다.
      touchAction: 'manipulation',
      textSizeAdjust: '100%',
      height: '100%',
    },
    'body, #root': {
      height: '100%',
    },
    body: {
      // 오버스크롤 바운스
      overscrollBehavior: 'none',
      // 롱프레스 컨텍스트 메뉴와 텍스트 선택.
      // 네이티브 앱에서 본문을 길게 눌러 선택되는 일은 없다.
      WebkitTouchCallout: 'none',
      userSelect: 'none',
      // 탭 하이라이트. 눌림 상태는 명시적으로 만든다.
      WebkitTapHighlightColor: 'transparent',
    },
    // 입력 필드는 예외다. 선택할 수 없는 입력은 고칠 수 없는 입력이다.
    'input, textarea': {
      userSelect: 'text',
      WebkitUserSelect: 'text',
    },
    // 브라우저 기본 링크 색과 밑줄을 남기지 않는다.
    a: {
      color: 'inherit',
      textDecoration: 'none',
    },
  },
})

export const system = createSystem(defaultConfig, config)

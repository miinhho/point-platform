import { chakra } from '@chakra-ui/react'

/** safe area inset 을 한 곳에서만 더한다. Android API 35+ 는 edge-to-edge 를 강제한다. */
export const Screen = chakra('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    bg: 'bg',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
  },
})

export const Gutter = chakra('div', { base: { paddingInline: 'gutter' } })

export const Header = chakra('header', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    minHeight: '52px',
    flexShrink: 0,
    paddingInline: 'gutter',
  },
})

export const Title = chakra('h1', { base: { flex: 1, minWidth: 0, textStyle: 'title' } })

export const Body = chakra('div', {
  base: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
    '&::-webkit-scrollbar': { display: 'none' },
  },
})

/**
 * 누를 수 있는 것의 공통 상태. `hover: hover` 로 가두는 것은 터치에서 탭한 자리에
 * hover 가 눌러붙기 때문이다 — 모바일이 주라 그대로 두면 지나간 줄이 계속 밝다.
 */
export const interactive = {
  '@media (hover: hover)': { _hover: { bg: 'bg.subtle' } },
  _focusVisible: { outline: '2px solid', outlineColor: 'colorPalette.focusRing', outlineOffset: '-2px' },
} as const

const rowBase = {
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  width: '100%',
  textAlign: 'start',
  paddingBlock: '3.5',
  paddingInline: 'gutter',
} as const

export const Row = chakra('div', { base: rowBase })

/**
 * 누를 수 있는 줄. Chakra 다형 프롭이 `type` 을 받지 않아 따로 둔다.
 *
 * 세 상태가 서로 다르게 보여야 한다 — 커서(`_hover`)는 옅게, 누르는 중(`_active`)은
 * 그보다 진하게, 포커스(`_focusVisible`)는 채우지 않고 링으로. 셋을 같은 색으로 두면
 * 셋 다 없는 것과 같다.
 */
export const RowButton = chakra('button', {
  base: {
    ...rowBase,
    ...interactive,
    _active: { bg: 'bg.muted' },
  },
})

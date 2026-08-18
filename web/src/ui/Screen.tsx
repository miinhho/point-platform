import { chakra } from '@chakra-ui/react'

/**
 * 화면 한 장.
 *
 * safe area inset 을 여기서 한 번만 더한다. Android API 35+ 에서 edge-to-edge 가
 * 강제되므로, 화면마다 각자 처리하면 반드시 어긋나는 곳이 생긴다.
 *
 * 높이가 `100%` 인 것은 화면 전환 때문이다. 전환 중에는 두 화면이 같은 자리에
 * 절대 위치로 겹치는데, 그때 높이가 내용에 따라 달라지면 화면이 튄다.
 */
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

/** 좌우 여백. 화면 안의 모든 내용은 이 안에 들어간다. */
export const Gutter = chakra('div', {
  base: { paddingInline: 'gutter' },
})

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

export const HeaderTitle = chakra('h1', {
  base: {
    flex: 1,
    minWidth: 0,
    fontSize: 'md',
    fontWeight: 'semibold',
    letterSpacing: '-0.01em',
  },
})

/**
 * 남은 공간을 채우며 스크롤한다.
 * 스크롤바는 숨긴다 — 네이티브 앱에 상시 스크롤바는 없다.
 */
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
 * 화면 하단에 고정되는 행동 영역.
 *
 * 가장 흔한 행동은 손가락이 닿는 자리에 있어야 한다. 화면 위쪽에 두면
 * 한 손으로 쓸 때 닿지 않는다.
 */
export const Footer = chakra('div', {
  base: {
    flexShrink: 0,
    paddingInline: 'gutter',
    paddingTop: '3',
    paddingBottom: '4',
  },
})

export const Card = chakra('div', {
  base: {
    bg: 'bg.panel',
    borderRadius: 'l3',
    borderWidth: '1px',
    borderColor: 'border',
  },
})

export const SectionLabel = chakra('div', {
  base: {
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'fg.muted',
  },
})

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

/** 목록 한 줄. 두 번째 소비자가 생기면 recipe 로 올린다. */
export const Row = chakra('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    width: '100%',
    textAlign: 'start',
    paddingBlock: '3.5',
    paddingInline: 'gutter',
  },
})

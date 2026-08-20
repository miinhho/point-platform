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

/**
 * 화면 하단의 행동 자리. 엄지가 제일 잘 닿는 곳이라 **그 화면의 주된 행동 하나**가
 * 앉는다. 화면마다 여백을 손으로 고르면 버튼이 화면마다 다른 높이에 선다.
 * 근거: docs/MOTION.md 「공간의 배분」
 */
export const Footer = chakra('div', {
  base: {
    flexShrink: 0,
    paddingInline: 'gutter',
    paddingTop: 'side',
    paddingBottom: 'inset',
    display: 'flex',
    flexDirection: 'column',
    gap: 'tight',
  },
})

/**
 * 목록 끝에 오는 행동. **`Footer` 와 다르다** — 함께 스크롤하고 엄지 자리를 차지하지
 * 않는다. 목록을 다 본 사람에게 다음 할 일을 주는 자리이지 그 화면의 주된 행동이
 * 아니다. 계좌 목록 아래의 「계좌 개설」이 같은 자리다.
 */
export const ListAction = chakra('div', {
  base: { paddingInline: 'gutter', paddingTop: 'inset', paddingBottom: 'block' },
})

/** 사실을 담는 면. 화면이 저마다 상자를 정의하면 같은 뜻의 상자가 화면마다 달라진다 */
export const Panel = chakra('div', {
  base: { bg: 'bg.panel', borderRadius: 'panel', padding: 'inset' },
  variants: {
    /** 테두리를 두른 면. 화면의 주인공일 때만 */
    raised: { true: { borderWidth: '1px', borderColor: 'border' } },
    /** 확정되지 않은 것. 완료와 같은 색일 수 없다 */
    pending: {
      true: { bg: 'pending.subtle', borderWidth: '1px', borderColor: 'pending.fg' },
    },
  },
})

/** 목록의 소제목. 줄과 줄 사이가 아니라 묶음 앞에 온다 */
export const SectionLabel = chakra('div', {
  base: {
    paddingInline: 'gutter',
    paddingTop: 'side',
    paddingBottom: 'bond',
    textStyle: 'caption',
  },
})

/**
 * 목록이 비었다는 한 줄. **실패와 같아 보이면 안 된다** — 실패는 `Loadable` 이
 * 맡는다. 규칙: CLAUDE.md 「없는 것과 못 불러온 것을 같게 보이지 않는다」
 */
export const Note = chakra('p', {
  base: {
    paddingInline: 'gutter',
    paddingBlock: 'part',
    textStyle: 'caption',
    textAlign: 'center',
  },
})

export const Header = chakra('header', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: 'tight',
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
  gap: 'side',
  width: '100%',
  textAlign: 'start',
  // 실기기 실측에서 이 높이가 오터치 없이 눌렸다 — docs/FIELD.md R2-7
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

import { chakra } from '@chakra-ui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { selectTabAtom, tabAtom } from './atoms'
import { TABS, type TabName } from './routes'

const Bar = chakra('nav', {
  base: {
    flexShrink: 0,
    display: 'grid',
    gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
    borderTopWidth: '1px',
    borderColor: 'border',
    bg: 'bg',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
})

const Tab = chakra('button', {
  base: {
    paddingBlock: '2.5',
    textStyle: 'caption',
    color: 'fg.muted',
    _active: { bg: 'bg.muted' },
  },
  variants: {
    selected: { true: { color: 'fg', textStyle: 'label' } },
  },
})

/** 역할과 무관하게 언제나 같다 — docs/JOURNEY.md 여정 8 */
export function TabBar() {
  const { t } = useTranslation()
  const tab = useAtomValue(tabAtom)
  const select = useSetAtom(selectTabAtom)

  return (
    <Bar aria-label={t('tab.home')}>
      {TABS.map((name: TabName) => (
        <Tab
          key={name}
          type="button"
          selected={name === tab}
          aria-current={name === tab ? 'page' : undefined}
          onClick={() => select(name)}
        >
          {t(`tab.${name}`)}
        </Tab>
      ))}
    </Bar>
  )
}

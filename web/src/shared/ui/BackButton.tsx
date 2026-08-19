import { chakra } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { interactive } from './Screen'

const Button = chakra('button', {
  base: {
    boxSize: '34px',
    marginInlineStart: '-8px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    color: 'fg',
    borderRadius: 'l1',
    ...interactive,
    _active: { bg: 'bg.muted' },
  },
})

/** 위치가 화면마다 흔들리면 사용자가 매번 다시 찾는다. */
export function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button type="button" aria-label={t('common.back')} onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M12.5 4.5 7 10l5.5 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  )
}

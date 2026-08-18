import { chakra } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

const Strip = chakra('div', {
  base: {
    flexShrink: 0,
    paddingBlock: '1.5',
    paddingInline: 'gutter',
    textStyle: 'verifyLabel',
    bg: 'verify.subtle',
    borderBottomWidth: '1px',
    borderColor: 'verify.fg',
    letterSpacing: '0.08em',
  },
})

/**
 * 발행 경로임을 알리는 띠. 색이 아니라 구조로 구분한다 — 색은 포인트의 것이고,
 * 발행에 또 쓰면 두 신호가 같은 채널에서 다툰다.
 */
export function IssueBanner() {
  const { t } = useTranslation()
  return <Strip>{t('confirm.issueBanner')}</Strip>
}

import { Box, VisuallyHidden } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { HoldButton } from '@/shared/ui/HoldButton'
import { Line } from '@/shared/ui/Line'
import { Body, Footer, Gutter, Header, Panel, Screen, Title } from '@/shared/ui/Screen'
import { Amount } from '../ui/Amount'
import { amountOf, type SealedDraft } from '../model/flow'
import { formatRate, inflationRate } from '../model/inflation'

interface Props {
  draft: SealedDraft
  onBack: () => void
  onConfirm: () => void
  busy: boolean
}

/**
 * 목적: 이 발행이 유통량을 어디까지 미는지 보고 정한다.
 *
 * 받는 사람 칸이 없다 — 발행에는 상대가 없고, 이체 화면을 빌려 쓰면 그 칸을
 * 채우려고 없는 말이 생긴다. 되돌릴 수 없게 만드는 것은 잔액이 아니라 유통량이라
 * 주의도 거기로 간다. 근거: docs/JOURNEY.md 여정 7
 */
export function ConfirmIssue({ draft, onBack, onConfirm, busy }: Props) {
  const { t } = useTranslation()
  const { pointType } = draft
  const amount = amountOf(draft)
  const rate = inflationRate(amount, pointType.totalIssued)

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('confirm.titleIssue')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="inset">
          <Panel raised>
            <Amount pointType={pointType} amount={amount} />

            <Box
              marginTop="block"
              paddingTop="inset"
              borderTopWidth="1px"
              borderColor="border"
              display="flex"
              flexDirection="column"
              gap="tight"
            >
              <Line label={t('confirm.supplyNow')} value={toGrouped(pointType.totalIssued)} />
              <Line
                label={t('confirm.supplyAfter')}
                value={toGrouped(pointType.totalIssued + amount)}
                textStyle="lineStrong"
              />
              <Line
                label={t('confirm.supplyChange')}
                value={rate === null ? t('confirm.supplyFirst') : `+${formatRate(rate)}`}
              />
              <Line label={t('confirm.cap')} value={toGrouped(pointType.issueCap)} />
            </Box>
          </Panel>
        </Gutter>
      </Body>

      <Footer>
        <VisuallyHidden aria-live="polite">{busy ? t('confirm.sendingIssue') : ''}</VisuallyHidden>
        <Box colorPalette={pointType.accent}>
          <HoldButton label={t('confirm.holdIssue')} onComplete={onConfirm} disabled={busy} />
        </Box>
      </Footer>
    </Screen>
  )
}

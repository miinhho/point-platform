import { Box, Text, chakra } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { Body, Gutter, Screen } from '@/shared/ui/Screen'

const Done = chakra('button', {
  base: {
    width: '100%',
    minHeight: 'control',
    borderRadius: 'l2',
    textStyle: 'button',
    bg: 'colorPalette.solid',
    color: 'colorPalette.contrast',
    _active: { bg: 'colorPalette.emphasized' },
  },
})

interface Props {
  transferId: string
  onHome: () => void
}

/** 근거: docs/JOURNEY.md 여정 6 — 서버가 확정을 알려준 뒤에만 완료라고 쓴다 */
export function Result({ transferId, onHome }: Props) {
  const { t } = useTranslation()
  const wallet = useQuery(walletQuery())
  const { data: transfer } = useQuery({
    queryKey: ['transfer', transferId],
    queryFn: () => endpoints.transfer(transferId),
  })

  if (!transfer) return null
  const balance =
    wallet.data?.balances.find((b) => b.pointType.id === transfer.pointTypeId)?.amount ?? 0
  const point = wallet.data?.balances.find((b) => b.pointType.id === transfer.pointTypeId)?.pointType

  return (
    <Screen>
      {transfer.kind === 'issue' ? <IssueBanner /> : null}
      <Body>
        <Gutter paddingTop="10">
          {/* 화면을 못 보는 사용자에게도 상태 변화를 알린다. */}
          <Text role="status" aria-live="polite" textStyle="headline">
            {transfer.kind === 'issue' ? t('result.titleIssue') : t('result.titleTransfer')}
          </Text>

          <Box marginTop="6" display="flex" flexDirection="column" gap="2">
            <Text textStyle="caption">{point?.name}</Text>
            <Text textStyle="balance">{toGrouped(transfer.amount)}</Text>
          </Box>

          <Box
            marginTop="6"
            paddingTop="4"
            borderTopWidth="1px"
            borderColor="border"
            display="flex"
            justifyContent="space-between"
            alignItems="baseline"
            gap="3"
          >
            {/* 발행은 잔액이 아니라 유통량을 말한다 */}
            <Text textStyle="caption">
              {transfer.kind === 'issue' ? t('result.supply') : t('result.remaining')}
            </Text>
            <Text textStyle="lineStrong">
              {toGrouped(transfer.kind === 'issue' ? (point?.totalIssued ?? 0) : balance)}
            </Text>
          </Box>
        </Gutter>
      </Body>

      <Gutter paddingBottom="4">
        <Box colorPalette={point?.accent ?? 'blue'}>
          <Done type="button" onClick={onHome}>
            {t('common.ok')}
          </Done>
        </Box>
      </Gutter>
    </Screen>
  )
}

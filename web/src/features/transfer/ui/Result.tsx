import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import type { Transfer } from '@/domain/types'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { Body, Gutter, Screen } from '@/shared/ui/Screen'
import { SentMark } from '@/shared/ui/SentMark'
import { draftAtom } from '../model/atoms'

interface Props {
  transfer: Transfer
  onHome: () => void
}

/** 근거: docs/JOURNEY.md 여정 6 — 서버가 확정을 알려준 뒤에만 완료라고 쓴다 */
export function Result({ transfer, onHome }: Props) {
  const { t } = useTranslation()
  const draft = useAtomValue(draftAtom)
  const wallet = useQuery(walletQuery())

  const issuing = transfer.kind === 'issue'
  // 초안이 포인트를 이미 안다. 지갑을 기다리면 그 사이 화면이 빈다.
  const point = draft?.pointType
  const balance =
    wallet.data?.balances.find((b) => b.pointType.id === transfer.pointTypeId)?.amount ?? null
  const supply = point ? point.totalIssued + transfer.amount : null

  return (
    <Screen>
      {issuing ? <IssueBanner /> : null}
      <Body>
        <Gutter paddingTop="10">
          <Box colorPalette={point?.accent ?? 'blue'}>
            <SentMark />
            <Text role="status" aria-live="polite" textStyle="headline" marginTop="4">
              {issuing ? t('result.titleIssue') : t('result.titleTransfer')}
            </Text>
            {draft?.to && !issuing ? (
              <Text textStyle="support">{draft.to.name}</Text>
            ) : null}

            <Box marginTop="6">
              <Text textStyle="label" color="colorPalette.fg">
                {point?.name}
              </Text>
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
                {issuing ? t('result.supply') : t('result.remaining')}
              </Text>
              <Text textStyle="lineStrong">
                {issuing ? toGrouped(supply ?? 0) : balance === null ? '' : toGrouped(balance)}
              </Text>
            </Box>
          </Box>
        </Gutter>
      </Body>

      <Gutter paddingBottom="4">
        <Button
          size="xl"
          width="full"
          colorPalette={point?.accent ?? 'blue'}
          onClick={onHome}
        >
          {t('common.ok')}
        </Button>
      </Gutter>
    </Screen>
  )
}

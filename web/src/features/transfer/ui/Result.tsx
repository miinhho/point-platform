import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { toGrouped } from '@/shared/format'
import type { Issue, Transfer } from '@/api/contract'
import { Body, Gutter, Screen } from '@/shared/ui/Screen'
import { SentMark } from '@/shared/ui/SentMark'
import { draftAtom, endFlowAtom } from '../model/atoms'

/** 근거: docs/JOURNEY.md 여정 6 — 서버가 확정을 알려준 뒤에만 완료라고 쓴다 */
export function Result({ result }: { result: Transfer | Issue }) {
  const { t } = useTranslation()
  const onHome = useSetAtom(endFlowAtom)
  const draft = useAtomValue(draftAtom)
  const wallet = useQuery(walletQuery())

  // 계약에서 둘은 다른 타입이다. 발행에만 있는 필드로 가른다.
  const issued = 'totalIssuedAfter' in result ? result : null
  const point = draft?.pointType
  const balance =
    wallet.data?.balances.find((b) => b.pointType.id === result.pointTypeId)?.amount ?? null

  return (
    <Screen>
      <Body>
        <Gutter paddingTop="10">
          <Box colorPalette={point?.accent ?? 'blue'}>
            <SentMark />
            <Text role="status" aria-live="polite" textStyle="headline" marginTop="4">
              {issued ? t('result.titleIssue') : t('result.titleTransfer')}
            </Text>
            {draft?.to && !issued ? (
              <Text textStyle="support">{draft.to.name}</Text>
            ) : null}

            <Box marginTop="6">
              <Text textStyle="label" color="colorPalette.fg">
                {point?.name}
              </Text>
              <Text textStyle="balance">{toGrouped(result.amount)}</Text>
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
                {issued ? t('result.supply') : t('result.remaining')}
              </Text>
              <Text textStyle="lineStrong">
                {issued
                  ? toGrouped(issued.totalIssuedAfter)
                  : balance === null
                    ? ''
                    : toGrouped(balance)}
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

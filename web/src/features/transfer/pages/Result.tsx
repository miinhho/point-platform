import { Box, Button, Skeleton, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/shared/format'
import type { Issue, Transfer } from '@/shared/contract'
import { Body, Footer, Gutter, Screen } from '@/shared/ui/Screen'
import { SentMark } from '@/shared/ui/SentMark'
import type { SealedDraft } from '../model/flow'
import { useResult } from '../model/useFlowPages'

interface Props {
  draft: SealedDraft
  result: Transfer | Issue
  onDone: () => void
}

/** 근거: docs/JOURNEY.md 여정 6 — 서버가 확정을 알려준 뒤에만 완료라고 쓴다 */
export function Result({ draft, result, onDone }: Props) {
  const { t } = useTranslation()
  const { remaining, failed } = useResult(result)

  // 계약에서 둘은 다른 타입이다. 발행에만 있는 필드로 가른다.
  const issued = 'totalIssuedAfter' in result ? result : null
  const point = draft.pointType

  return (
    <Screen>
      <Body>
        <Gutter paddingTop="open">
          <Box colorPalette={point.accent}>
            <SentMark />
            <Text role="status" aria-live="polite" textStyle="headline" marginTop="inset">
              {issued ? t('result.titleIssue') : t('result.titleTransfer')}
            </Text>
            {issued ? null : <Text textStyle="support">{draft.to.name}</Text>}

            <Box marginTop="block">
              <Text textStyle="label" color="colorPalette.fg">
                {point.name}
              </Text>
              <Text textStyle="balance">{toGrouped(result.amount)}</Text>
            </Box>

            <Box
              marginTop="block"
              paddingTop="inset"
              borderTopWidth="1px"
              borderColor="border"
              display="flex"
              justifyContent="space-between"
              alignItems="baseline"
              gap="side"
            >
              {/* 발행은 잔액이 아니라 유통량을 말한다 */}
              <Text textStyle="caption">
                {issued ? t('result.supply') : t('result.remaining')}
              </Text>
              {issued ? (
                <Text textStyle="lineStrong">{toGrouped(issued.totalIssuedAfter)}</Text>
              ) : remaining !== null ? (
                <Text textStyle="lineStrong">{toGrouped(remaining)}</Text>
              ) : failed ? (
                <Text textStyle="caption">{t('result.balanceUnknown')}</Text>
              ) : (
                <Skeleton height="4" width="80px" />
              )}
            </Box>
          </Box>
        </Gutter>
      </Body>

      <Footer>
        <Button size="xl" width="full" colorPalette={point.accent} onClick={onDone}>
          {t('common.ok')}
        </Button>
      </Footer>
    </Screen>
  )
}

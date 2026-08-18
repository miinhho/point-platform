import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { pointTypeQuery, walletQuery } from '@/api/queries'
import { goAtom } from '@/app/atoms'
import { toGrouped } from '@/shared/format'
import { startIssueAtom, startTransferAtom } from '@/features/transfer'
import { BackButton } from '@/shared/ui/BackButton'
import { IssuerSuffix } from '@/shared/ui/IssuerSuffix'
import { Line } from '@/shared/ui/Line'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import type { PointType, PointTypeId } from '@/api/contract'
import { formatCreated } from '../model/created'

/**
 * 포인트 하나에 페이지 하나다. 보는 사람에 따라 내용이 늘어날 뿐 다른 페이지가
 * 되지 않는다 — docs/JOURNEY.md 「은행 페이지」
 */
export function Bank({ pointTypeId, onBack }: { pointTypeId: PointTypeId; onBack: () => void }) {
  const { t } = useTranslation()
  const { data: pointType } = useQuery(pointTypeQuery(pointTypeId))
  const wallet = useQuery(walletQuery())
  const startTransfer = useSetAtom(startTransferAtom)
  const startIssue = useSetAtom(startIssueAtom)
  const go = useSetAtom(goAtom)

  const balance = wallet.data?.balances.find((b) => b.pointType.id === pointTypeId)

  if (!pointType) return null

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{pointType.name}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="4" paddingBottom="6" colorPalette={pointType.accent}>
          <Intro pointType={pointType} />

          {balance ? (
            <Box marginTop="6" display="flex" flexDirection="column" gap="3">
              <Line
                label={t('bank.myBalance')}
                value={toGrouped(balance.amount)}
                textStyle="lineStrong"
              />
              <Button
                size="xl"
                width="full"
                disabled={balance.sendable === 0}
                onClick={() => startTransfer({ pointType })}
              >
                {t('bank.send')}
              </Button>
            </Box>
          ) : null}

          {pointType.canIssue ? (
            <Box marginTop="8" display="flex" flexDirection="column" gap="3">
              <Box display="flex" flexDirection="column" gap="2">
                <Line label={t('bank.cap')} value={toGrouped(pointType.issueCap)} />
                <Line
                  label={t('bank.headroom')}
                  value={toGrouped(pointType.issuableHeadroom)}
                  textStyle="lineStrong"
                />
              </Box>
              <Button
                size="xl"
                width="full"
                onClick={() => wallet.data && startIssue({ pointType, me: wallet.data.user })}
              >
                {t('bank.issue')}
              </Button>
              {/* 상한도 발행과 같은 무게다. 그래서 같은 자리에 둔다 — 여정 9 */}
              <Button
                size="lg"
                width="full"
                variant="outline"
                onClick={() => go({ name: 'changeCap', pointTypeId: pointType.id })}
              >
                {t('cap.entry')}
              </Button>
            </Box>
          ) : null}
        </Gutter>
      </Body>
    </Screen>
  )
}

/**
 * 흉내낼 수 없는 것만 판단의 근거가 된다 — 이름·기호·색은 전부 고르는 것이고
 * 핸들은 하나뿐이다. 근거: docs/JOURNEY.md 여정 10
 */
function Intro({ pointType }: { pointType: PointType }) {
  const { t } = useTranslation()

  return (
    <>
      <Box display="flex" alignItems="center" gap="3">
        <PointBadge symbol={pointType.symbol} />
        <Box flex={1} minW={0}>
          <Text textStyle="name">{pointType.name}</Text>
          <IssuerSuffix pointType={pointType} />
        </Box>
      </Box>

      <Box marginTop="5" display="flex" flexDirection="column" gap="2">
        <Line label={t('bank.issuer')} value={pointType.issuerHandle} textStyle="mono" />
        <Line label={t('bank.created')} value={formatCreated(pointType.createdAt)} />
        <Line label={t('bank.supply')} value={toGrouped(pointType.totalIssued)} />
      </Box>
    </>
  )
}

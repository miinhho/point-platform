import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import { startIssueAtom } from '@/features/transfer/atoms'
import { BackButton } from '@/shared/ui/BackButton'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'

/** 유통량은 발행자만 본다 — docs/JOURNEY.md 여정 8 */
export function Issuer({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const { data } = useQuery(walletQuery())
  const startIssue = useSetAtom(startIssueAtom)

  const mine = data?.balances.filter((b) => b.pointType.issuerId === data.user.id) ?? []

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('issuer.title')}</Title>
      </Header>

      <Body>
        {mine.map(({ pointType }) => (
          <Gutter key={pointType.id} paddingTop="4">
            <Box colorPalette={pointType.accent}>
              <Text textStyle="name">{pointType.name}</Text>
              <Box marginTop="3" display="flex" flexDirection="column" gap="2">
                <Line label={t('issuer.supply')} value={toGrouped(pointType.totalIssued)} />
                <Line label={t('issuer.cap')} value={toGrouped(pointType.issueCap)} />
                <Line
                  label={t('issuer.headroom')}
                  value={toGrouped(pointType.issueCap - pointType.totalIssued)}
                  strong
                />
              </Box>
              <Box marginTop="4">
                <Button
                  size="xl"
                  width="full"
                  onClick={() => data && startIssue({ pointType, me: data.user })}
                >
                  {t('issuer.issue')}
                </Button>
              </Box>
            </Box>
          </Gutter>
        ))}
      </Body>
    </Screen>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box display="flex" alignItems="baseline" justifyContent="space-between" gap="3">
      <Text textStyle="caption">{label}</Text>
      <Text textStyle={strong ? 'lineStrong' : 'line'}>{value}</Text>
    </Box>
  )
}

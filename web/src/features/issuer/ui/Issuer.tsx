import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { goAtom } from '@/app/atoms'
import { toGrouped } from '@/shared/format'
import { startIssueAtom } from '@/features/transfer'
import { BackButton } from '@/shared/ui/BackButton'
import { Line } from '@/shared/ui/Line'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'

/** 유통량은 발행자만 본다 — docs/JOURNEY.md 여정 8 */
export function Issuer({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const { data } = useQuery(walletQuery())
  const startIssue = useSetAtom(startIssueAtom)
  const go = useSetAtom(goAtom)

  const mine = data?.balances.filter((b) => b.pointType.canIssue) ?? []

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
                  value={toGrouped(pointType.issuableHeadroom)}
                  textStyle="lineStrong"
                />
              </Box>
              <Box marginTop="4" display="flex" flexDirection="column" gap="2">
                <Button
                  size="xl"
                  width="full"
                  onClick={() => data && startIssue({ pointType, me: data.user })}
                >
                  {t('issuer.issue')}
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
            </Box>
          </Gutter>
        ))}
      </Body>
    </Screen>
  )
}

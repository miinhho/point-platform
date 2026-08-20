import { Box, Button, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { PointType } from '@/shared/contract'
import { toGrouped } from '@/shared/format'
import { Line } from '@/shared/ui/Line'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Body, Footer, Gutter, Screen } from '@/shared/ui/Screen'

/** 근거: docs/JOURNEY.md 여정 9 — 만든 것이 어디 있는지 말한다 */
export function PointCreated({
  pointType,
  onHome,
}: {
  pointType: PointType
  onHome: () => void
}) {
  const { t } = useTranslation()

  return (
    <Screen>
      <Body>
        <Gutter paddingTop="open" colorPalette={pointType.accent}>
          <Text role="status" aria-live="polite" textStyle="headline">
            {t('create.made')}
          </Text>
          <Text textStyle="support" marginTop="bond">
            {t('create.madeWhere')}
          </Text>

          <Box marginTop="part" display="flex" alignItems="center" gap="side">
            <PointBadge emoji={pointType.emoji} />
            <Text textStyle="name">{pointType.name}</Text>
          </Box>

          <Box marginTop="block" display="flex" flexDirection="column" gap="tight">
            <Line label={t('bank.supply')} value={toGrouped(pointType.totalIssued)} />
            <Line
              label={t('bank.cap')}
              value={toGrouped(pointType.issueCap)}
              textStyle="lineStrong"
            />
          </Box>
        </Gutter>
      </Body>

      <Footer>
        <Button size="xl" width="full" onClick={onHome}>
          {t('failure.home')}
        </Button>
      </Footer>
    </Screen>
  )
}

import { Box, Button, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { PointType } from '@/shared/contract'
import { toGrouped } from '@/shared/format'
import { Line } from '@/shared/ui/Line'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Body, Gutter, Screen } from '@/shared/ui/Screen'

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
        <Gutter paddingTop="12" colorPalette={pointType.accent}>
          <Text role="status" aria-live="polite" textStyle="headline">
            {t('create.made')}
          </Text>
          <Text textStyle="support" marginTop="1">
            {t('create.madeWhere')}
          </Text>

          <Box marginTop="8" display="flex" alignItems="center" gap="3">
            <PointBadge emoji={pointType.emoji} />
            <Text textStyle="name">{pointType.name}</Text>
          </Box>

          <Box marginTop="6" display="flex" flexDirection="column" gap="2">
            <Line label={t('bank.supply')} value={toGrouped(pointType.totalIssued)} />
            <Line
              label={t('bank.cap')}
              value={toGrouped(pointType.issueCap)}
              textStyle="lineStrong"
            />
          </Box>
        </Gutter>
      </Body>

      <Gutter paddingBottom="4">
        <Button size="xl" width="full" onClick={onHome}>
          {t('failure.home')}
        </Button>
      </Gutter>
    </Screen>
  )
}

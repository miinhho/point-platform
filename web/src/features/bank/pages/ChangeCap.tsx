import { Box, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { PointType } from '@/shared/contract'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { Line } from '@/shared/ui/Line'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { CapForm } from '../ui/CapForm'

interface Props {
  pointType: PointType
  onDone: () => void
}

/**
 * 목적: 이 은행의 상한을 바꾼다.
 *
 * 상한을 바꾸는 동안은 그것이 이 화면의 일이라 페이지를 통째로 내준다. 은행
 * 페이지에 폼을 얹고 확정 버튼을 하단에 고정하면 **되돌릴 수 없는 조작이 엄지가
 * 제일 잘 닿는 자리에 상주한다** — 그 자리는 그 화면의 주된 행동이 앉는 자리다.
 * 관측: docs/FIELD.md W5-2 · 근거: docs/MOTION.md 「공간의 배분」
 *
 * 주의: 지금 상한 → 유통량 → 새 값 → 가진 사람에게 무엇을 하는가 → 확정.
 * 여기서 하면 안 되는 일: 발행·보내기·명부로 새는 길을 두지 않는다.
 */
export function ChangeCap({ pointType, onDone }: Props) {
  const { t } = useTranslation()

  return (
    <Screen>
      <Header>
        <BackButton onClick={onDone} />
        <Title>{t('cap.title')}</Title>
        <Text textStyle="caption" colorPalette={pointType.accent} color="colorPalette.fg">
          {pointType.name}
        </Text>
      </Header>

      <Body>
        <Gutter paddingTop="inset" display="flex" flexDirection="column" gap="block">
          <Box display="flex" flexDirection="column" gap="tight">
            <Line label={t('bank.cap')} value={toGrouped(pointType.issueCap)} />
            <Line label={t('bank.supply')} value={toGrouped(pointType.totalIssued)} />
          </Box>

          <CapForm pointType={pointType} onChanged={onDone} />
        </Gutter>
      </Body>
    </Screen>
  )
}

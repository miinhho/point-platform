import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { walletQuery } from '@/api/queries'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { Line } from '@/shared/ui/Line'
import { AmountSkeleton, LineSkeleton, Loadable, NameSkeleton } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import type { PointType, Transfer } from '@/api/contract'
import { formatTime } from '../model/time'

interface Props {
  transferId: string
  onBack: () => void
}

/**
 * 되돌리는 버튼이 없다. 있으면 앱 전체가 "사실 되돌릴 수 있다" 는 전제 위에 선다.
 * 근거: docs/JOURNEY.md 여정 8
 */
export function HistoryDetail({ transferId, onBack }: Props) {
  const { t } = useTranslation()
  const one = useQuery({
    queryKey: ['transfer', transferId],
    queryFn: () => endpoints.transfer(transferId),
  })
  const transfer = one.data
  const wallet = useQuery(walletQuery())

  // 못 불러온 것을 빈 화면으로 두지 않는다. 헤더는 남겨야 돌아갈 길이 보인다.
  if (!transfer) {
    return (
      <Screen>
        <Header>
          <BackButton onClick={onBack} />
          <Title>{t('history.detailTitleTransfer')}</Title>
        </Header>
        <Body>
          <Loadable
            pending={one.isPending}
            failed={one.isError}
            onRetry={() => void one.refetch()}
            label={t('history.detailFailed')}
            skeleton={
              /*
                이 화면의 실제 모양이다 — 큰 이름 → 핸들 → 포인트 이름 + 큰 금액 →
                아래 줄. 균일한 줄 넷을 두면 제일 큰 둘에 자리가 없어 내용이 오는
                순간 통째로 재배치된다.
              */
              <Gutter paddingTop="4" display="flex" flexDirection="column">
                <NameSkeleton />
                <Box marginTop="2">
                  <LineSkeleton />
                </Box>
                <Box marginTop="5" display="flex" flexDirection="column" gap="2">
                  <NameSkeleton width="28%" />
                  <AmountSkeleton />
                </Box>
                <Box marginTop="6">
                  <LineSkeleton />
                </Box>
              </Gutter>
            }
          >
            {null}
          </Loadable>
        </Body>
      </Screen>
    )
  }

  const point = wallet.data?.balances.find((b) => b.pointType.id === transfer.pointTypeId)?.pointType

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('history.detailTitleTransfer')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          <Sent transfer={transfer} point={point} />
        </Gutter>
      </Body>
    </Screen>
  )
}

interface PartProps {
  transfer: Transfer
  point: PointType | undefined
}

/**
 * 목적: 내가 그때 누구에게 얼마를 보냈는지 확인한다.
 *
 * 주의는 목록에서 이어져 온 「누구에게 · 얼마」에 이미 있다 — `layoutId` 가 눌린 줄을
 * 펼친 것으로 읽히게 한다. 상세가 할 일은 그 주위에 언제·무엇을 붙이는 것뿐이다.
 * 되돌리는 버튼도, 다시 보내기도 두지 않는다 — 확인하러 온 화면이 행동으로 미끄러진다.
 */
function Sent({ transfer, point }: PartProps) {
  const { t } = useTranslation()
  const other = transfer.counterparty

  return (
    <>
      {/* 누구에게 → 무엇을 → 얼마. 목록과 같은 순서라야 눌린 줄이 펼쳐진 것으로 읽힌다 */}
      <motion.div layoutId={`t-${transfer.id}-to`} layout="position">
        <Text textStyle="name">{other.name}</Text>
      </motion.div>
      <Text
        textStyle={other.nameIsShared ? 'handleVerify' : 'handle'}
        color={other.nameIsShared ? 'verify.fg' : undefined}
      >
        {other.handle}
      </Text>

      <Box marginTop="5" colorPalette={point?.accent ?? 'blue'}>
        <Text textStyle="label" color="colorPalette.fg">
          {point?.name ?? ''}
        </Text>
        <motion.div layoutId={`t-${transfer.id}-amount`} layout="position">
          <Text textStyle="balance">{toGrouped(transfer.amount)}</Text>
        </motion.div>
      </Box>

      <Box marginTop="6" display="flex" flexDirection="column">
        <Line divided label={t('history.at')} value={formatTime(transfer.confirmedAt)} />
      </Box>
    </>
  )
}


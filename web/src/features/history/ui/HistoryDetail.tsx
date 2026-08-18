import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { usersQuery, walletQuery } from '@/api/queries'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { Line } from '@/shared/ui/Line'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
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
  const { data: transfer } = useQuery({
    queryKey: ['transfer', transferId],
    queryFn: () => endpoints.transfer(transferId),
  })
  const wallet = useQuery(walletQuery())
  const users = useQuery(usersQuery(''))

  if (!transfer) return null

  const issuing = transfer.kind === 'issue'
  const point = wallet.data?.balances.find((b) => b.pointType.id === transfer.pointTypeId)?.pointType
  const to = users.data?.find((user) => user.id === transfer.toId)

  return (
    <Screen>
      {issuing ? <IssueBanner /> : null}
      <Header>
        <BackButton onClick={onBack} />
        <Title>{issuing ? t('history.detailTitleIssue') : t('history.detailTitleTransfer')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          {/* 누구에게 → 무엇을 → 얼마. 목록과 같은 순서라야 눌린 줄이 펼쳐진 것으로 읽힌다 */}
          <motion.div layoutId={`t-${transfer.id}-to`} layout="position">
            <Text textStyle="name">{issuing ? t('history.me') : (to?.name ?? t('history.me'))}</Text>
          </motion.div>
          {issuing || !to ? null : <Text textStyle="handle">{to.handle}</Text>}

          <Box marginTop="5" colorPalette={point?.accent ?? 'blue'}>
            <Text textStyle="label" color="colorPalette.fg">
              {point?.name ?? ''}
            </Text>
            <motion.div layoutId={`t-${transfer.id}-amount`} layout="position">
              <Text textStyle="balance">{toGrouped(transfer.amount)}</Text>
            </motion.div>
          </Box>

          <Box marginTop="6" display="flex" flexDirection="column">
            <Line
              divided
              label={t('history.from')}
              value={issuing ? t('history.fromIssue') : t('history.me')}
            />
            <Line divided label={t('history.at')} value={formatTime(transfer.confirmedAt)} />
            {/* 두 번 보내지지 않았다를 사용자가 확인할 수 있는 유일한 근거다 */}
            <Line
              divided
              label={t('history.requestKey')}
              value={transfer.idempotencyKey}
              textStyle="mono"
            />
          </Box>
        </Gutter>
      </Body>
    </Screen>
  )
}

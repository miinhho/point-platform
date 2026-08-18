import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { usersQuery, walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import { BackButton } from '@/shared/ui/BackButton'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { formatTime } from './time'

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
          <motion.div layoutId={`t-${transfer.id}-name`}>
            <Text textStyle="name">{point?.name ?? ''}</Text>
          </motion.div>
          <Box marginTop="2">
            <motion.div layoutId={`t-${transfer.id}-amount`}>
              <Text textStyle="balance">{toGrouped(transfer.amount)}</Text>
            </motion.div>
          </Box>

          <Box marginTop="6" display="flex" flexDirection="column">
            <Field label={t('history.from')} value={issuing ? t('history.fromIssue') : t('history.me')} />
            <Field
              label={t('history.to')}
              value={to ? `${to.name} ${to.handle}` : t('history.me')}
            />
            <Field label={t('history.at')} value={formatTime(transfer.confirmedAt)} />
            {/* 두 번 보내지지 않았다를 사용자가 확인할 수 있는 유일한 근거다 */}
            <Field label={t('history.requestKey')} value={transfer.idempotencyKey} mono />
          </Box>
        </Gutter>
      </Body>
    </Screen>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box
      display="flex"
      alignItems="baseline"
      justifyContent="space-between"
      gap="4"
      paddingBlock="2.5"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <Text textStyle="caption" flexShrink={0}>
        {label}
      </Text>
      <Text textStyle={mono ? 'mono' : 'line'} textAlign="end">
        {value}
      </Text>
    </Box>
  )
}

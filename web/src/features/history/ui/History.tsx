import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { historyQuery, usersQuery, walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import { goAtom } from '@/app/atoms'
import { Body, Gutter, Header, RowButton, Screen, Title } from '@/shared/ui/Screen'
import type { Transfer } from '@/domain/types'
import { formatTime } from '../model/time'

/** 근거: docs/JOURNEY.md 여정 8 */
export function History() {
  const { t } = useTranslation()
  const go = useSetAtom(goAtom)
  const { data, isPending } = useQuery(historyQuery())
  const wallet = useQuery(walletQuery())
  const users = useQuery(usersQuery(''))

  const pointOf = (transfer: Transfer) =>
    wallet.data?.balances.find((b) => b.pointType.id === transfer.pointTypeId)?.pointType
  /** 발행은 내 지갑으로 들어온 것이므로 상대가 없다 */
  const toOf = (transfer: Transfer) =>
    transfer.kind === 'issue'
      ? t('history.me')
      : (users.data?.find((user) => user.id === transfer.toId)?.name ?? t('history.me'))

  return (
    <Screen>
      <Header>
        <Title>{t('history.title')}</Title>
      </Header>

      <Body>
        {isPending ? (
          <Text textStyle="caption" textAlign="center" paddingBlock="8">
            {t('common.loading')}
          </Text>
        ) : null}

        {data?.length === 0 ? (
          <Gutter>
            <Text textStyle="caption" textAlign="center" paddingBlock="8">
              {t('history.empty')}
            </Text>
          </Gutter>
        ) : null}

        {data?.map((transfer) => (
          <RowButton
            key={transfer.id}
            type="button"
            onClick={() => go({ name: 'historyDetail', transferId: transfer.id })}
          >
            <Box flex={1} minW={0}>
              {/*
                사용자가 보는 순서는 누구에게 → 무엇을 → 얼마다.
                `layout="position"` 이 아니면 크기가 다른 두 요소를 이을 때 글자가 늘어난다.
              */}
              <motion.div layoutId={`t-${transfer.id}-to`} layout="position">
                <Text textStyle="name">{toOf(transfer)}</Text>
              </motion.div>
              <Text textStyle="caption">
                {transfer.kind === 'issue' ? `${t('history.issued')} · ` : ''}
                {pointOf(transfer)?.name} · {formatTime(transfer.confirmedAt)}
              </Text>
            </Box>
            <motion.div layoutId={`t-${transfer.id}-amount`} layout="position">
              <Text textStyle="line">{toGrouped(transfer.amount)}</Text>
            </motion.div>
          </RowButton>
        ))}
      </Body>
    </Screen>
  )
}

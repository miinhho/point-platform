import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { historyQuery, walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import { goAtom } from '@/app/atoms'
import { Body, Gutter, Header, RowButton, Screen, Title } from '@/shared/ui/Screen'
import type { Transfer } from '@/domain/types'

/** 근거: docs/JOURNEY.md 여정 8 */
export function History() {
  const { t } = useTranslation()
  const go = useSetAtom(goAtom)
  const { data, isPending } = useQuery(historyQuery())
  const wallet = useQuery(walletQuery())

  const nameOf = (transfer: Transfer) =>
    wallet.data?.balances.find((b) => b.pointType.id === transfer.pointTypeId)?.pointType.name ?? ''

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
              {/* 목록의 이름이 상세의 이름으로 이어진다. 화면은 밀지 않는다. */}
              <motion.div layoutId={`t-${transfer.id}-name`}>
                <Text textStyle="name">{nameOf(transfer)}</Text>
              </motion.div>
              <Text textStyle="caption">
                {transfer.kind === 'issue' ? `${t('history.issued')} · ` : ''}
                {formatTime(transfer.createdAt)}
              </Text>
            </Box>
            <motion.div layoutId={`t-${transfer.id}-amount`}>
              <Text textStyle="line">{toGrouped(transfer.amount)}</Text>
            </motion.div>
          </RowButton>
        ))}
      </Body>
    </Screen>
  )
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getMonth() + 1}.${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

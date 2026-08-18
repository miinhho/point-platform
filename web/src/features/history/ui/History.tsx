import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { historyQuery, usersQuery, walletQuery } from '@/api/queries'
import { toGrouped } from '@/shared/format'
import { goAtom } from '@/app/atoms'
import { Body, Gutter, Header, Row, RowButton, Screen, Title } from '@/shared/ui/Screen'
import type { CapChange, Transfer } from '@/api/contract'
import { formatTime } from '../model/time'

/** 근거: docs/JOURNEY.md 여정 8 */
export function History() {
  const { t } = useTranslation()
  const go = useSetAtom(goAtom)
  const { data, isPending } = useQuery(historyQuery())
  const wallet = useQuery(walletQuery())
  const users = useQuery(usersQuery(''))

  const pointOf = (pointTypeId: string) =>
    wallet.data?.balances.find((b) => b.pointType.id === pointTypeId)?.pointType
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

        {data?.map((entry) =>
          entry.type === 'transfer' ? (
            <TransferRow
              key={entry.transfer.id}
              transfer={entry.transfer}
              to={toOf(entry.transfer)}
              pointName={pointOf(entry.transfer.pointTypeId)?.name ?? ''}
              onOpen={() => go({ name: 'historyDetail', transferId: entry.transfer.id })}
            />
          ) : (
            <CapChangeRow
              key={entry.capChange.id}
              capChange={entry.capChange}
              pointName={pointOf(entry.capChange.pointTypeId)?.name ?? ''}
            />
          ),
        )}
      </Body>
    </Screen>
  )
}

interface TransferRowProps {
  transfer: Transfer
  to: string
  pointName: string
  onOpen: () => void
}

function TransferRow({ transfer, to, pointName, onOpen }: TransferRowProps) {
  const { t } = useTranslation()

  return (
    <RowButton type="button" onClick={onOpen}>
      <Box flex={1} minW={0}>
        {/*
          사용자가 보는 순서는 누구에게 → 무엇을 → 얼마다.
          `layout="position"` 이 아니면 크기가 다른 두 요소를 이을 때 글자가 늘어난다.
        */}
        <motion.div layoutId={`t-${transfer.id}-to`} layout="position">
          <Text textStyle="name">{to}</Text>
        </motion.div>
        <Text textStyle="caption">
          {transfer.kind === 'issue' ? `${t('history.issued')} · ` : ''}
          {pointName} · {formatTime(transfer.confirmedAt)}
        </Text>
      </Box>
      <motion.div layoutId={`t-${transfer.id}-amount`} layout="position">
        <Text textStyle="line">{toGrouped(transfer.amount)}</Text>
      </motion.div>
    </RowButton>
  )
}

/**
 * 상한 변경은 눌러도 갈 곳이 없다 — 단건 조회는 이체만이다. 그래서 버튼이 아니고,
 * 「누구에게 → 무엇을 → 얼마」 자리에 사람도 금액도 넣지 않는다. 위계를 빌려 쓰면
 * 이체 목록으로 읽힌다.
 */
function CapChangeRow({ capChange, pointName }: { capChange: CapChange; pointName: string }) {
  const { t } = useTranslation()
  const raised = capChange.issueCap > capChange.previousCap

  return (
    <Row>
      <Box flex={1} minW={0}>
        <Text textStyle="label">
          {t(raised ? 'history.capRaised' : 'history.capLowered', { name: pointName })}
        </Text>
        <Text textStyle="caption">
          {t('history.capFromTo', {
            from: toGrouped(capChange.previousCap),
            to: toGrouped(capChange.issueCap),
          })}
          {' · '}
          {formatTime(capChange.changedAt)}
        </Text>
      </Box>
    </Row>
  )
}

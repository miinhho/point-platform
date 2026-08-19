import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { historyQuery, walletQuery } from '@/api/queries'
import { toGrouped } from '@/shared/format'
import { goAtom } from '@/app/atoms'
import { Loadable, RowSkeleton } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, Row, RowButton, Screen, Title } from '@/shared/ui/Screen'
import type { CapChange, Issue, Transfer } from '@/api/contract'
import { formatTime } from '../model/time'

/** 근거: docs/JOURNEY.md 여정 8 */
export function History() {
  const { t } = useTranslation()
  const go = useSetAtom(goAtom)
  const { data, isPending, isError, refetch } = useQuery(historyQuery())
  const wallet = useQuery(walletQuery())

  const pointOf = (pointTypeId: string) =>
    wallet.data?.balances.find((b) => b.pointType.id === pointTypeId)?.pointType

  return (
    <Screen>
      <Header>
        <Title>{t('history.title')}</Title>
      </Header>

      <Body>
        {/* 가운데 글자 한 줄을 두면 목록이 뜨는 순간 화면이 통째로 뛴다 */}
        <Loadable
          pending={isPending}
          failed={isError}
          onRetry={() => void refetch()}
          label={t('history.loadFailed')}
          skeleton={
            <>
              {[0, 1, 2, 3, 4].map((row) => (
                <RowSkeleton key={row} trailing="72px" />
              ))}
            </>
          }
        >
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
                pointName={pointOf(entry.transfer.pointTypeId)?.name ?? ''}
                onOpen={() => go({ name: 'historyDetail', transferId: entry.transfer.id })}
              />
            ) : entry.type === 'issue' ? (
              <IssueRow
                key={entry.issue.id}
                issue={entry.issue}
                pointName={pointOf(entry.issue.pointTypeId)?.name ?? ''}
                onOpen={() => go({ name: 'issueDetail', issueId: entry.issue.id })}
              />
            ) : (
              <CapChangeRow
                key={entry.capChange.id}
                capChange={entry.capChange}
                pointName={pointOf(entry.capChange.pointTypeId)?.name ?? ''}
              />
            ),
          )}
        </Loadable>
      </Body>
    </Screen>
  )
}

interface TransferRowProps {
  transfer: Transfer
  pointName: string
  onOpen: () => void
}

function TransferRow({ transfer, pointName, onOpen }: TransferRowProps) {
  return (
    <RowButton type="button" onClick={onOpen}>
      <Box flex={1} minW={0}>
        {/*
          사용자가 보는 순서는 누구에게 → 무엇을 → 얼마다.
          `layout="position"` 이 아니면 크기가 다른 두 요소를 이을 때 글자가 늘어난다.
        */}
        <motion.div layoutId={`t-${transfer.id}-to`} layout="position">
          <Text textStyle="name">{transfer.counterparty.name}</Text>
        </motion.div>
        <Text textStyle="caption">
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
 * 발행에는 「누구에게」가 없다. 이체 줄의 위계를 빌려 쓰면 셋이 한 종류로 읽힌다 —
 * `CapChangeRow` 와 같은 판단이다.
 */
function IssueRow({
  issue,
  pointName,
  onOpen,
}: {
  issue: Issue
  pointName: string
  onOpen: () => void
}) {
  const { t } = useTranslation()

  return (
    <RowButton type="button" onClick={onOpen}>
      <Box flex={1} minW={0}>
        <motion.div layoutId={`i-${issue.id}-name`} layout="position">
          <Text textStyle="label">{t('history.issuedTo', { name: pointName })}</Text>
        </motion.div>
        <Text textStyle="caption">{formatTime(issue.confirmedAt)}</Text>
      </Box>
      <motion.div layoutId={`i-${issue.id}-amount`} layout="position">
        <Text textStyle="line">{toGrouped(issue.amount)}</Text>
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

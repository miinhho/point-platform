import { Box, Text } from '@chakra-ui/react'
import { useSetAtom } from 'jotai'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/shared/format'
import { goAtom } from '@/app/atoms'
import { Loadable, RowSkeleton } from '@/shared/ui/Loadable'
import { Body, Header, Note, RowButton, Screen, Title } from '@/shared/ui/Screen'
import type { PointMark, Issue, Transfer } from '@/shared/contract'
import { counterpartyLine } from '../model/direction'
import { formatTime } from '../model/time'
import { useHistoryPage } from '../model/useHistory'

/** 근거: docs/JOURNEY.md 여정 8 */
export function History() {
  const { t } = useTranslation()
  const go = useSetAtom(goAtom)
  const { data, pending, failed, retry } = useHistoryPage()


  return (
    <Screen>
      <Header>
        <Title>{t('history.title')}</Title>
      </Header>

      <Body>
        {/* 가운데 글자 한 줄을 두면 목록이 뜨는 순간 화면이 통째로 뛴다 */}
        <Loadable
          pending={pending}
          failed={failed}
          onRetry={retry}
          label={t('history.loadFailed')}
          skeleton={
            <>
              {[0, 1, 2, 3, 4].map((row) => (
                <RowSkeleton key={row} trailing="72px" />
              ))}
            </>
          }
        >
          {data?.length === 0 ? <Note>{t('history.empty')}</Note> : null}

          {data?.map((entry) => {
            if (entry.type === 'transfer') {
              return (
                <TransferRow
                  key={entry.transfer.id}
                  transfer={entry.transfer}
                  point={entry.point}
                  onOpen={() => go({ name: 'historyDetail', transferId: entry.transfer.id })}
                />
              )
            }
            if (entry.type === 'issue') {
              return (
                <IssueRow
                  key={entry.issue.id}
                  issue={entry.issue}
                  point={entry.point}
                  onOpen={() => go({ name: 'issueDetail', issueId: entry.issue.id })}
                />
              )
            }
            return notDrawn(entry)
          })}
        </Loadable>
      </Body>
    </Screen>
  )
}

interface TransferRowProps {
  transfer: Transfer
  point: PointMark
  onOpen: () => void
}

function TransferRow({ transfer, point, onOpen }: TransferRowProps) {
  const { t } = useTranslation()

  return (
    <RowButton type="button" onClick={onOpen}>
      <Box flex={1} minW={0}>
        {/*
          사용자가 보는 순서는 누구에게 → 무엇을 → 얼마다. 방향은 그 첫 자리에 조사로
          붙는다 — 「30,000」 한 줄만 보면 보낸 것과 받은 것이 같아 보인다.
          `layout="position"` 이 아니면 크기가 다른 두 요소를 이을 때 글자가 늘어난다.
        */}
        <motion.div layoutId={`t-${transfer.id}-to`} layout="position">
          <Text textStyle="name">{counterpartyLine(t, transfer)}</Text>
        </motion.div>
        <Text textStyle="caption">
          {point.name} · {formatTime(transfer.occurredAt)}
        </Text>
      </Box>
      <motion.div layoutId={`t-${transfer.id}-amount`} layout="position">
        <Text textStyle="line">{toGrouped(transfer.amount)}</Text>
      </motion.div>
    </RowButton>
  )
}

/**
 * 아직 그리지 않는 갈래. **인자가 `never` 라 갈래가 늘면 여기서 컴파일이 멈춘다.**
 *
 * 계약에는 구매가 더 있고(원장 6 단계) 서버가 그것을 내기 시작하는 날이 온다. 그때
 * 「나머지는 발행」으로 두면 `entry.issue` 가 없어 **내역 화면 전체가 죽는다** — 실패
 * 코드를 빠뜨렸을 때보다 크고 늦게 터진다.
 */
function notDrawn(_entry: never): null {
  return null
}

/** 발행에는 「누구에게」가 없다. 이체 줄의 위계를 빌려 쓰면 둘이 한 종류로 읽힌다 */
function IssueRow({
  issue,
  point,
  onOpen,
}: {
  issue: Issue
  point: PointMark
  onOpen: () => void
}) {
  const { t } = useTranslation()

  return (
    <RowButton type="button" onClick={onOpen}>
      <Box flex={1} minW={0}>
        <motion.div layoutId={`i-${issue.id}-name`} layout="position">
          <Text textStyle="label">{t('history.issuedTo', { name: point.name })}</Text>
        </motion.div>
        <Text textStyle="caption">{formatTime(issue.occurredAt)}</Text>
      </Box>
      <motion.div layoutId={`i-${issue.id}-amount`} layout="position">
        <Text textStyle="line">{toGrouped(issue.amount)}</Text>
      </motion.div>
    </RowButton>
  )
}

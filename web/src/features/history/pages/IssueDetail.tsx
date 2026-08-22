import { Box, Text } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { Line } from '@/shared/ui/Line'
import { AmountSkeleton, LineSkeleton, Loadable, NameSkeleton } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { formatTime } from '../model/time'
import { useIssueDetail } from '../model/useHistory'

interface Props {
  issueId: string
  onBack: () => void
}

/**
 * 목적: 그 발행이 유통량을 어디까지 밀었는지 확인한다.
 *
 * 발행에는 상대가 없다. 이체 상세의 「누구에게」·「보낸 사람」 칸을 빌려 쓰면 빈 칸을
 * 채우려고 「나」와 「무에서」가 나온다 — 계약: docs/API.md 「발행은 이체가 아니다」.
 *
 * 유통량과 상한은 **그때의 값**을 서버가 실어 준다. 지금 `PointType` 에서 읽으면
 * 지난주 발행의 상세에 오늘 유통량이 뜬다 — 그 사이 다른 발행이 끼면 틀리고,
 * 상한이 바뀌었으면 여력도 틀린다. 일어난 일은 일어난 때의 값을 갖는다.
 */
export function IssueDetail({ issueId, onBack }: Props) {
  const { t } = useTranslation()
  const { data: detail, pending, failed, absent, retry } = useIssueDetail(issueId)

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('history.detailTitleIssue')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="inset">
          <Loadable
            pending={pending}
            failed={failed}
            absent={absent}
            absentLabel={t('history.detailAbsent')}
            onRetry={retry}
            label={t('history.detailFailed')}
            skeleton={
              <Box display="flex" flexDirection="column">
                <NameSkeleton width="28%" />
                <Box marginTop="tight">
                  <AmountSkeleton />
                </Box>
                <Box marginTop="block" display="flex" flexDirection="column" gap="inset">
                  <LineSkeleton />
                  <LineSkeleton />
                  <LineSkeleton />
                </Box>
              </Box>
            }
          >
            {detail ? (
              <>
                <Box colorPalette={detail.point.accent}>
                  <motion.div layoutId={`i-${detail.issue.id}-name`} layout="position">
                    <Text textStyle="caption">{detail.point.name}</Text>
                  </motion.div>
                  <motion.div layoutId={`i-${detail.issue.id}-amount`} layout="position">
                    <Text textStyle="balance">{toGrouped(detail.issue.amount)}</Text>
                  </motion.div>
                </Box>

                <Box marginTop="block" display="flex" flexDirection="column">
                  <Line
                    divided
                    label={t('history.supplyAfter')}
                    value={toGrouped(detail.issue.totalIssuedAfter)}
                  />
                  <Line
                    divided
                    label={t('history.capAt')}
                    value={toGrouped(detail.issue.issueCapAt)}
                  />
                  <Line
                    divided
                    label={t('history.issuedAt')}
                    value={formatTime(detail.issue.occurredAt)}
                  />
                </Box>
              </>
            ) : null}
          </Loadable>
        </Gutter>
      </Body>
    </Screen>
  )
}

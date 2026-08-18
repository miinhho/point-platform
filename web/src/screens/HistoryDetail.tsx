import { Box, Text } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { Amount } from '@/ui/Amount'
import { BackButton } from '@/ui/BackButton'
import { Body, Card, Gutter, Header, HeaderTitle, Screen } from '@/ui/Screen'
import { formatTime, StatusLine } from './History'
import { PROGRESS_STEPS, type Transfer, type User } from '@/domain/types'

interface Props {
  transfer: Transfer
  to: User | null
  from: User | null
  onBack: () => void
}

/**
 * 내역 상세 (여정 7).
 *
 * 목록에서 눌렀던 이름과 금액이 **그대로 자리를 옮겨** 여기 온다 (`layoutId`).
 * 새 화면이 튀어나오는 것과 방금 누른 줄이 펼쳐지는 것은 다른 경험이고,
 * 후자에서는 "내가 무엇을 눌렀는지" 다시 확인할 필요가 없다.
 *
 * 여기에 "이체 취소" 같은 것은 없다. 확정된 이체는 되돌릴 수 없고, 되돌릴 수 없는
 * 것을 되돌리는 버튼을 관리자에게도 만들지 않는다 — 그 버튼이 있으면 앱 전체가
 * "사실 되돌릴 수 있다"는 전제 위에 서게 된다.
 */
export function HistoryDetail({ transfer, to, from, onBack }: Props) {
  const isIssue = transfer.kind === 'issue'

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <HeaderTitle>{isIssue ? '발행 내역' : '이체 내역'}</HeaderTitle>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          <motion.div layoutId={`transfer-${transfer.id}-name`}>
            <Text textStyle="name">{to?.name ?? '알 수 없음'}</Text>
          </motion.div>
          <Text textStyle="handle">
            {to?.handle ?? ''}
          </Text>

          <Box marginTop="4">
            <motion.div layoutId={`transfer-${transfer.id}-amount`}>
              <Amount value={transfer.amount} size="display" />
            </motion.div>
          </Box>

          <Box marginTop="2">
            <StatusLine transfer={transfer} />
          </Box>

          <Card marginTop="6" padding="4">
            <Field label="보낸 사람" value={isIssue ? '발행 (무에서)' : (from?.name ?? '나')} />
            <Field label="받은 사람" value={to ? `${to.name} ${to.handle}` : '알 수 없음'} />
            <Field label="요청 시각" value={formatTime(transfer.createdAt)} />
            {transfer.confirmedAt ? (
              <Field label="확정 시각" value={formatTime(transfer.confirmedAt)} />
            ) : null}
            <Field
              label="진행"
              value={`${transfer.completedSteps.length} / ${PROGRESS_STEPS.length} 단계`}
            />
            {/*
              멱등성 키를 노출한다. 이 값이 같으면 같은 이체라는 것이 이 앱에서
              "두 번 보내지지 않았다"를 확인할 수 있는 유일한 근거다.
            */}
            <Field label="요청 키" value={transfer.idempotencyKey} mono />
            {transfer.failure ? <Field label="실패 사유" value={transfer.failure.code} tone="red.fg" /> : null}
          </Card>
        </Gutter>
      </Body>
    </Screen>
  )
}

function Field({
  label,
  value,
  mono,
  tone,
}: {
  label: string
  value: string
  mono?: boolean
  tone?: string
}) {
  return (
    <Box
      display="flex"
      alignItems="baseline"
      justifyContent="space-between"
      gap="4"
      paddingBlock="2"
      _notLast={{ borderBottomWidth: '1px', borderColor: 'border' }}
    >
      <Text fontSize="sm" color="fg.muted" flexShrink={0}>
        {label}
      </Text>
      <Text
        fontSize="sm"
        color={tone ?? 'fg'}
        textAlign="right"
        wordBreak="break-all"
        fontFamily={mono ? 'mono' : undefined}
      >
        {value}
      </Text>
    </Box>
  )
}

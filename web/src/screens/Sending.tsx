import { useEffect, useState } from 'react'
import { Box, chakra, Text } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'
import { Amount } from '@/ui/Amount'
import { MotionButton, useTapScale } from '@/ui/motion'
import { Body, Card, Footer, Gutter, Header, HeaderTitle, Screen } from '@/ui/Screen'
import { cancelWindowRemaining } from '@/domain/rules'
import { PROGRESS_STEPS, type ProgressStep, type Transfer, type User } from '@/domain/types'

interface Props {
  transfer: Transfer
  to: User
  onCancel: () => void
}

/**
 * 보내는 중 (여정 5).
 *
 * 사용자가 이 화면에서 하려는 것은 딱 두 가지다 — **되돌릴 수 있으면 되돌리는 것**,
 * 그리고 **끝났는지 아는 것**. 그 외의 정보는 여기 있을 이유가 없다.
 *
 * 그래서 처음에 넣었던 것 두 개를 뺐다.
 *
 *  - **카운트다운 숫자.** "3초 후 보냅니다"는 남은 시간을 세는 일을 사용자에게
 *    떠넘긴다. 사용자가 알아야 하는 것은 "지금 취소할 수 있다"는 사실뿐이고,
 *    그것은 취소 버튼이 화면에 있는지로 이미 말해진다. 남은 시간은 버튼 안의
 *    가는 선으로만 남긴다 — 읽는 것이 아니라 보이는 것이다.
 *  - **진행 4단계.** "원장 검증 중"을 알아도 사용자가 할 수 있는 일이 없다.
 *    행동을 만들지 못하는 정보는 정보가 아니라 소음이다.
 *
 * 다만 단계를 지운 것이 아니라 **미뤄 두었다.** 오래 걸리기 시작하면 그때는
 * "어디까지 갔나"가 행동을 만드는 정보가 된다 — 기다릴지, 나갔다 올지.
 */
const STEP_LABEL: Record<'transfer' | 'issue', Record<ProgressStep, string>> = {
  transfer: {
    withdraw: '내 잔액에서 출금',
    request: '이체 요청 전송',
    verify: '원장 검증',
    deposit: '받는 사람에게 입금',
  },
  issue: {
    withdraw: '발행 준비',
    request: '원장에 기록',
    verify: '유통량 검증',
    deposit: '받는 사람에게 지급',
  },
}

/** 이보다 오래 걸리면 단계를 드러낸다. 그때부터는 "어디까지 갔나"가 행동을 만든다. */
const SLOW_MS = 4000

export function Sending({ transfer, to, onCancel }: Props) {
  const remaining = useCancelWindow(transfer.cancelableUntil)
  const cancelable = remaining > 0
  const slow = useSlowness(transfer.cancelableUntil, cancelable)
  const isIssue = transfer.kind === 'issue'

  return (
    <Screen>
      <Header>
        {/* 뒤로 버튼이 없다. 이 구간에서 back 은 실행 취소가 아니고, 있는 척하지 않는다. */}
        <HeaderTitle>{isIssue ? '발행하는 중' : '보내는 중'}</HeaderTitle>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          <Card padding="5">
            <Text textStyle="name" marginBottom="1">
              {to.name}
              <Text as="span" textStyle="handle" marginLeft="2">
                {to.handle}
              </Text>
            </Text>
            <Amount value={transfer.amount} size="display" />
          </Card>

          <Text marginTop="4" fontSize="sm" color="fg.muted">
            {cancelable
              ? `아직 아무것도 처리되지 않았다. 지금 취소하면 ${isIssue ? '총 유통량은' : '잔액은'} 그대로다.`
              : '취소할 수 없다. 끝나면 결과가 나온다.'}
          </Text>

          {slow ? <Progress kind={transfer.kind} completed={transfer.completedSteps} /> : null}
        </Gutter>
      </Body>

      <Footer>
        {cancelable ? (
          <CancelButton
            onCancel={onCancel}
            remaining={remaining}
            until={transfer.cancelableUntil}
            issue={isIssue}
          />
        ) : null}
      </Footer>
    </Screen>
  )
}

/** 남은 취소 시간. 서버가 준 시각만 보고 계산한다. */
function useCancelWindow(cancelableUntil: string): number {
  const [remaining, setRemaining] = useState(() => cancelWindowRemaining(cancelableUntil))

  useEffect(() => {
    setRemaining(cancelWindowRemaining(cancelableUntil))
    if (cancelWindowRemaining(cancelableUntil) <= 0) return

    const timer = setInterval(() => {
      const left = cancelWindowRemaining(cancelableUntil)
      setRemaining(left)
      if (left <= 0) clearInterval(timer)
    }, 100)
    return () => clearInterval(timer)
  }, [cancelableUntil])

  return remaining
}

/** 처리가 예상보다 오래 걸리는가. */
function useSlowness(cancelableUntil: string, cancelable: boolean): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (cancelable) return
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [cancelable, cancelableUntil])

  return slow
}

interface CancelButtonProps {
  onCancel: () => void
  remaining: number
  until: string
  issue: boolean
}

/**
 * 취소 버튼이 곧 남은 시간이다.
 *
 * 버튼 안쪽 선이 줄어들고, 다 줄면 버튼이 사라진다. 숫자를 읽지 않아도
 * "곧 못 누른다"가 보이고, 못 누르게 된 순간은 버튼이 없다는 것으로 확실해진다.
 */
function CancelButton({ onCancel, remaining, until, issue }: CancelButtonProps) {
  const tap = useTapScale()
  const reduced = useReducedMotion()

  return (
    <MotionButton
      type="button"
      whileTap={tap}
      onClick={onCancel}
      position="relative"
      overflow="hidden"
      width="100%"
      minHeight="54px"
      borderRadius="l2"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      color="fg"
      fontSize="md"
      fontWeight="medium"
    >
      <Text position="relative">취소</Text>
      <motion.div
        key={until}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: reduced ? 0 : remaining / 1000, ease: 'linear' }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '3px',
          transformOrigin: 'left',
          background: issue
            ? 'var(--chakra-colors-issue-solid)'
            : 'var(--chakra-colors-pending-fg)',
        }}
      />
    </MotionButton>
  )
}

/**
 * 진행 단계. 오래 걸릴 때만 나타난다.
 *
 * 서버가 끝냈다고 한 것만 완료로 그린다. 클라이언트가 앞질러 표시하면, 실패했을 때
 * 사용자는 이미 끝났다고 본 단계가 사실은 안 끝났다는 걸 알게 된다.
 */
function Progress({ kind, completed }: { kind: 'transfer' | 'issue'; completed: ProgressStep[] }) {
  const reduced = useReducedMotion()
  const done = new Set(completed)

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Box marginTop="6">
        <Text fontSize="xs" color="fg.muted" marginBottom="2">
          평소보다 오래 걸린다. 지금 여기까지 왔다.
        </Text>
        {PROGRESS_STEPS.map((step, index) => {
          const isDone = done.has(step)
          const isNext = !isDone && completed.length === index
          return (
            <Box key={step} display="flex" alignItems="center" gap="3" paddingBlock="2">
              <StepMark done={isDone} next={isNext} issue={kind === 'issue'} />
              <Text
                fontSize="md"
                color={isDone || isNext ? 'fg' : 'fg.subtle'}
                fontWeight={isNext ? 'medium' : 'normal'}
              >
                {STEP_LABEL[kind][step]}
              </Text>
            </Box>
          )
        })}
      </Box>
    </motion.div>
  )
}

function StepMark({ done, next, issue }: { done: boolean; next: boolean; issue: boolean }) {
  return (
    <chakra.span
      aria-hidden
      flexShrink={0}
      width="22px"
      height="22px"
      borderRadius="full"
      display="grid"
      placeItems="center"
      fontSize="xs"
      lineHeight="1"
      bg={done ? (issue ? 'issue.solid' : 'green.solid') : 'transparent'}
      color={done ? (issue ? 'issue.contrast' : 'green.contrast') : 'fg.subtle'}
      borderWidth={done ? '0' : '1px'}
      borderColor={next ? 'pending.fg' : 'border'}
    >
      {done ? '✓' : ''}
    </chakra.span>
  )
}

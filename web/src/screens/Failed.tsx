import { Box, Text } from '@chakra-ui/react'
import { Amount } from '@/ui/Amount'
import { BackButton } from '@/ui/BackButton'
import { MotionButton, useTapScale } from '@/ui/motion'
import { Body, Card, Footer, Gutter, Header, HeaderTitle, Screen } from '@/ui/Screen'
import { explainFailure } from '@/domain/failures'
import type { Failure, Points, TransferKind, User } from '@/domain/types'

interface Props {
  kind: TransferKind
  to: User
  amount: Points
  failure: Failure
  onRetry: () => void
  onEditAmount: () => void
  onRepick: () => void
  onHome: () => void
}

/**
 * 실패했다 (여정 6).
 *
 * 사용자가 하려는 것은 다시 시도하는 것이다. 그러니 입력을 버리지 않는다 —
 * 받는 사람도 금액도 그대로 남아 있고, 재시도는 **같은 멱등성 키**로 나간다.
 * 그 키가 없으면 재시도는 같은 돈을 두 번 보내는 일이 된다.
 *
 * 화면은 세 가지를 말한다. 무엇이 실패했는지, **돈이 어디 있는지**, 지금 뭘 할 수
 * 있는지. 가운데가 가장 중요하다.
 */
export function Failed({
  kind,
  to,
  amount,
  failure,
  onRetry,
  onEditAmount,
  onRepick,
  onHome,
}: Props) {
  const tap = useTapScale()
  const explanation = explainFailure(failure.code, kind)

  return (
    <Screen>
      <Header>
        <BackButton onClick={onHome} />
        <HeaderTitle>보내지 못했다</HeaderTitle>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          <Text fontSize="xl" fontWeight="semibold">
            {explanation.title}
          </Text>

          {/*
            돈의 위치. 이 화면에서 가장 중요한 한 문장이라서 눈에 띄는 자리에 둔다.
            결과를 알 수 없는 실패는 색을 달리해 "단정하지 않았다"는 것을 드러낸다.
          */}
          <Box
            marginTop="4"
            padding="4"
            borderRadius="l2"
            bg={explanation.outcomeUnknown ? 'pending.subtle' : 'bg.panel'}
            borderWidth="1px"
            borderColor={explanation.outcomeUnknown ? 'pending.fg' : 'border'}
          >
            <Text fontSize="xs" fontWeight="medium" color="fg.muted" marginBottom="1">
              {explanation.outcomeUnknown ? '지금 확실한 것' : '돈은 여기 있다'}
            </Text>
            <Text fontSize="md">{explanation.whereIsMoney}</Text>
          </Box>

          {/* 입력을 버리지 않았다는 것을 보여준다. 다시 입력하게 만들지 않는다. */}
          <Card marginTop="4" padding="4">
            <Text fontSize="sm" color="fg.muted" marginBottom="2">
              보내려던 것
            </Text>
            <Text textStyle="name">
              {to.name}
              <Text as="span" textStyle="handle" marginLeft="2">
                {to.handle}
              </Text>
            </Text>
            <Box marginTop="2">
              <Amount value={amount} size="medium" />
            </Box>
          </Card>
        </Gutter>
      </Body>

      <Footer>
        <Box display="flex" flexDirection="column" gap="2">
          {explanation.retryable ? (
            <Action primary tap={tap} onClick={onRetry}>
              다시 시도
            </Action>
          ) : null}
          {explanation.editable ? (
            <Action primary={!explanation.retryable} tap={tap} onClick={onEditAmount}>
              금액 고치기
            </Action>
          ) : null}
          {explanation.repickable ? (
            <Action primary tap={tap} onClick={onRepick}>
              받는 사람 다시 고르기
            </Action>
          ) : null}
          <Action tap={tap} onClick={onHome}>
            홈으로
          </Action>
        </Box>
      </Footer>
    </Screen>
  )
}

interface ActionProps {
  children: string
  primary?: boolean
  tap: { scale: number } | undefined
  onClick: () => void
}

function Action({ children, primary, tap, onClick }: ActionProps) {
  return (
    <MotionButton
      type="button"
      whileTap={tap}
      onClick={onClick}
      width="100%"
      minHeight="52px"
      borderRadius="l2"
      bg={primary ? 'blue.solid' : 'transparent'}
      color={primary ? 'blue.contrast' : 'fg.muted'}
      borderWidth={primary ? '0' : '1px'}
      borderColor="border"
      fontSize="md"
      fontWeight="medium"
    >
      {children}
    </MotionButton>
  )
}

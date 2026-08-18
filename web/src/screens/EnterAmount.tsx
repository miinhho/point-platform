import { Text } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'
import { amountFontSize } from '@/ui/amountFit'
import { Keypad } from '@/ui/Keypad'
import { MotionButton, useTapScale } from '@/ui/motion'
import { BackButton } from '@/ui/BackButton'
import { Body, Footer, Gutter, Header, HeaderTitle, Screen } from '@/ui/Screen'
import { label, parseInput, UNIT_SYMBOL } from '@/domain/points'
import type { TransferKind, User } from '@/domain/types'

interface Props {
  kind: TransferKind
  to: User
  raw: string
  /** 넘을 수 없는 값. 이체는 잔액, 발행은 남은 발행 여력 */
  ceiling: number
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  onNext: () => void
  onBack: () => void
}

/**
 * 금액 입력 (여정 3 — 금액을 정한다).
 *
 * 사용자는 계산하는 게 아니라 머릿속의 금액을 숫자로 옮긴다. 옮기다 자릿수를
 * 틀리는 것이 이 화면이 막아야 할 유일한 실수다.
 *
 * 그래서 숫자 아래에 항상 한글을 둔다. `1,500,000`과 `15,000,000`은 `0` 하나
 * 차이라 훑으면 같아 보이지만, "백오십만"과 "천오백만"은 다르게 읽힌다.
 */
export function EnterAmount({
  kind,
  to,
  raw,
  ceiling,
  onDigit,
  onBackspace,
  onClear,
  onNext,
  onBack,
}: Props) {
  const tap = useTapScale()
  const reduced = useReducedMotion()
  const amount = parseInput(raw)
  const parts = label(amount)
  const over = amount > ceiling
  const ready = amount > 0 && !over

  const isIssue = kind === 'issue'
  const ceilingLabel = isIssue ? '남은 발행 여력' : '보낼 수 있는 금액'

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <HeaderTitle>
          {to.name}
          <Text as="span" textStyle="handle" marginLeft="2">
            {to.handle}
          </Text>
        </HeaderTitle>
      </Header>

      {/*
        금액은 헤더 바로 아래에 둔다. 사용자가 확인하는 것은 "누구에게 얼마"라는
        한 쌍이므로, 받는 사람과 금액이 떨어져 있으면 두 번 훑어야 한다.
        가운데 정렬하면 화면 높이에 따라 그 거리가 달라져서 더 나쁘다.
      */}
      <Body>
        <Gutter paddingTop="6">
          {/*
            자릿수가 바뀌는 순간에만 움직인다. 키를 누를 때마다 흔들면 그건 정보가
            아니라 소음이고, 정작 자릿수가 달라진 순간이 묻힌다.
          */}
          <motion.div
            key={raw.length}
            initial={reduced ? false : { y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 34 }}
          >
            <Text
              textStyle="amount"
              fontSize={amountFontSize(parts.grouped)}
              color={over ? 'red.fg' : amount === 0 ? 'fg.subtle' : 'fg'}
              whiteSpace="nowrap"
            >
              {parts.grouped}
              <Text as="span" fontSize="0.5em" fontWeight="medium" color="fg.muted" marginLeft="1">
                {UNIT_SYMBOL}
              </Text>
            </Text>

            {/* 검증의 본체. 금액이 0 일 때도 자리를 비워 두어 화면이 튀지 않게 한다. */}
            {/*
              한글 표기는 줄바꿈을 허용한다. 숫자와 달리 한글은 두 줄이 되어도
              읽는 데 지장이 없고, 잘려서 "일조이천삼백사십오억…" 로 끝나는 것보다
              낫다. `keep-all` 은 단어 중간에서 끊기지 않게 한다.
            */}
            <Text
              marginTop="1"
              fontSize="md"
              color={over ? 'red.fg' : 'fg.muted'}
              minHeight="1.5em"
              wordBreak="keep-all"
            >
              {amount > 0 ? parts.koreanWithUnit : ''}
            </Text>
          </motion.div>

          <Text marginTop="5" fontSize="sm" color={over ? 'red.fg' : 'fg.muted'}>
            {over ? `${ceilingLabel}을 넘었다 · ` : `${ceilingLabel} `}
            {label(ceiling).grouped} {UNIT_SYMBOL}
          </Text>
        </Gutter>
      </Body>

      <Keypad onDigit={onDigit} onBackspace={onBackspace} onClear={onClear} />

      <Footer paddingTop="2">
        <MotionButton
          type="button"
          whileTap={ready ? tap : undefined}
          onClick={onNext}
          disabled={!ready}
          width="100%"
          minHeight="54px"
          borderRadius="l2"
          bg={isIssue ? 'issue.solid' : 'blue.solid'}
          color={isIssue ? 'issue.contrast' : 'blue.contrast'}
          fontSize="md"
          fontWeight="medium"
          // 누를 수 없는 버튼을 감추지 않는다. 자리가 사라지면 화면이 흔들리고,
          // 사용자는 다음에 무엇을 해야 하는지 알 수 없게 된다.
          _disabled={{ opacity: 0.35, cursor: 'default' }}
        >
          {isIssue ? '발행 확인' : '보내기 확인'}
        </MotionButton>
      </Footer>
    </Screen>
  )
}

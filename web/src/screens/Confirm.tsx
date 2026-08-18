import { Box, Text } from '@chakra-ui/react'
import { Amount } from '@/ui/Amount'
import { BackButton } from '@/ui/BackButton'
import { HoldButton } from '@/ui/HoldButton'
import { Body, Card, Footer, Gutter, Header, HeaderTitle, Screen } from '@/ui/Screen'
import { formatRate, inflationRate } from '@/domain/ledger'
import { label, UNIT_SYMBOL } from '@/domain/points'
import type { Account, Ledger, Points, TransferKind, User } from '@/domain/types'

interface Props {
  kind: TransferKind
  to: User
  amount: Points
  account: Account | null
  ledger: Ledger | null
  onConfirm: () => void
  onBack: () => void
  /** 요청이 나가는 중. 홀드를 두 번 완료해도 두 번 보내지 않는다 */
  busy?: boolean
}

/**
 * 확정 (여정 4 — 보낼지 결정한다).
 *
 * 사용자가 하려는 것은 "이게 맞나"를 마지막으로 점검하는 것이고, 맞으면 지체 없이
 * 보내는 것이다. 그래서 이 화면은 **보낸 뒤의 세계를 전부** 보여준다 — 누구에게,
 * 얼마를, 그리고 **보내고 나면 얼마가 남는지.**
 *
 * 남는 잔액이 여기 있는 이유: 사용자가 확인하려는 것은 금액 자체가 아니라 "이걸
 * 보내도 괜찮은가"다. 그 판단에 필요한 값을 화면이 대신 계산해 주지 않으면 사용자가
 * 머릿속에서 뺄셈을 해야 하고, 그 뺄셈은 틀린다.
 *
 * 확인 다이얼로그는 없다. 이 화면 자체가 확인이고, 확정은 홀드다.
 */
export function Confirm({ kind, to, amount, account, ledger, onConfirm, onBack, busy }: Props) {
  const isIssue = kind === 'issue'

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <HeaderTitle>{isIssue ? '이렇게 발행한다' : '이렇게 보낸다'}</HeaderTitle>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          <Card padding="5">
            {/* 받는 사람이 먼저다. 금액을 아무리 확인해도 사람이 틀리면 소용없다. */}
            <Box display="flex" alignItems="center" gap="3" marginBottom="5">
              <Box
                aria-hidden
                flexShrink={0}
                width="44px"
                height="44px"
                borderRadius="full"
                bg={isIssue ? 'issue.subtle' : 'bg.muted'}
                color={isIssue ? 'issue.fg' : 'fg.muted'}
                display="grid"
                placeItems="center"
                fontSize="md"
                fontWeight="medium"
              >
                {to.name.slice(0, 1)}
              </Box>
              <Box minW={0}>
                <Text textStyle="name">{to.name}</Text>
                {/*
                  여기서는 핸들을 항상 본문 대비로 둔다. 대상 목록에서는 겹칠 때만
                  올렸지만, 이 화면은 되돌릴 수 없는 행동 직전이고 확인할 것이 하나뿐이다.
                */}
                <Text fontSize="sm" color="fg.muted">
                  {to.handle}
                </Text>
              </Box>
            </Box>

            <Amount value={amount} size="display" verify />

            <Box
              marginTop="5"
              paddingTop="4"
              borderTopWidth="1px"
              borderColor="border"
              display="flex"
              flexDirection="column"
              gap="2"
            >
              {isIssue ? (
                <IssueAftermath amount={amount} ledger={ledger} />
              ) : (
                <TransferAftermath amount={amount} account={account} />
              )}
            </Box>
          </Card>
        </Gutter>
      </Body>

      <Footer>
        <HoldButton
          label={isIssue ? '꾹 눌러서 발행' : '꾹 눌러서 보내기'}
          tone={isIssue ? 'issue' : 'transfer'}
          onComplete={onConfirm}
          disabled={busy}
        />
      </Footer>
    </Screen>
  )
}

/** 보낸 뒤의 내 잔액. 사용자가 머릿속에서 뺄셈하지 않게 한다. */
function TransferAftermath({ amount, account }: { amount: Points; account: Account | null }) {
  if (!account) return null
  const after = account.balance - amount

  return (
    <>
      <Row label="지금 잔액" value={`${label(account.balance).grouped} ${UNIT_SYMBOL}`} />
      <Row
        label="보낸 뒤 남는 잔액"
        value={`${label(after).grouped} ${UNIT_SYMBOL}`}
        emphasis
        tone={after < 0 ? 'danger' : undefined}
      />
    </>
  )
}

/**
 * 발행 뒤의 세계 (여정 7).
 *
 * 이체는 내 잔액을 줄이지만 발행은 전체 유통량을 늘린다. 그래서 보여줄 값이 다르다 —
 * 개인의 실수와 경제의 실수는 크기가 다르고, 변화율이 그 크기다.
 */
function IssueAftermath({ amount, ledger }: { amount: Points; ledger: Ledger | null }) {
  if (!ledger) return null
  const after = ledger.totalIssued + amount
  const rate = inflationRate(amount, ledger.totalIssued)

  return (
    <>
      <Row label="지금 총 유통량" value={`${label(ledger.totalIssued).grouped} ${UNIT_SYMBOL}`} />
      <Row
        label="발행 뒤 총 유통량"
        value={`${label(after).grouped} ${UNIT_SYMBOL}`}
        emphasis
        tone={after > ledger.issueCap ? 'danger' : undefined}
      />
      <Row label="유통량 변화" value={`+${formatRate(rate)}`} tone="issue" />
    </>
  )
}

interface RowProps {
  label: string
  value: string
  emphasis?: boolean
  tone?: 'danger' | 'issue'
}

function Row({ label: name, value, emphasis, tone }: RowProps) {
  const color = tone === 'danger' ? 'red.fg' : tone === 'issue' ? 'issue.fg' : emphasis ? 'fg' : 'fg.muted'
  return (
    <Box display="flex" alignItems="baseline" justifyContent="space-between" gap="3">
      <Text fontSize="sm" color="fg.muted">
        {name}
      </Text>
      <Text
        fontSize={emphasis ? 'md' : 'sm'}
        fontWeight={emphasis ? 'medium' : 'normal'}
        fontVariantNumeric="tabular-nums"
        color={color}
      >
        {value}
      </Text>
    </Box>
  )
}

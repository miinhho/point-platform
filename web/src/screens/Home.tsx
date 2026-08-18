import { Box, chakra, Text } from '@chakra-ui/react'
import { Amount } from '@/ui/Amount'
import { ColorModeSelect } from '@/ui/ColorModeSelect'
import { MotionButton, useTapScale } from '@/ui/motion'
import { Body, Card, Footer, Gutter, Header, HeaderTitle, Screen, SectionLabel } from '@/ui/Screen'
import { label } from '@/domain/points'
import type { Account, Ledger, User } from '@/domain/types'

interface Props {
  account: Account | null
  ledger: Ledger | null
  recent: User[]
  onQuickPick: (to: User) => void
  onOpenPicker: () => void
  onOpenIssue: () => void
  onOpenDevPanel: () => void
  onOpenHistory: () => void
}

/** 홈에 두는 최근 대상 수. 스크롤 없이 손가락이 닿는 범위. */
const RECENT_LIMIT = 4

/**
 * 홈 (여정 1 — 앱을 연다).
 *
 * 이 앱을 여는 사람의 대부분은 보내려고 연다. 그래서 계좌 목록이나 메뉴가 아니라
 * 최근 보낸 사람이 먼저 있고, 탭 한 번에 금액 입력으로 들어간다.
 *
 * 잔액은 "얼마 있다"가 아니라 "전체 중 얼마"로 읽히게 둔다. 유한한 자원이라고
 * 인지하지 못하면 보내는 행동의 무게가 전달되지 않는다.
 */
export function Home({
  account,
  ledger,
  recent,
  onQuickPick,
  onOpenPicker,
  onOpenIssue,
  onOpenDevPanel,
  onOpenHistory,
}: Props) {
  const tap = useTapScale()
  const isIssuer = account?.user.role === 'issuer'
  const headroom = ledger ? ledger.issueCap - ledger.totalIssued : 0

  return (
    <Screen>
      <Header>
        <HeaderTitle>내 포인트</HeaderTitle>
        {/* 개발자 패널. 실서버로 바꾸면 사라질 것이므로 눈에 띄지 않는 자리에 둔다. */}
        <chakra.button
          type="button"
          aria-label="개발자 패널"
          onClick={onOpenDevPanel}
          flexShrink={0}
          width="30px"
          height="30px"
          display="grid"
          placeItems="center"
          fontSize="sm"
          color="fg.subtle"
        >
          ⚙
        </chakra.button>
        <ColorModeSelect />
      </Header>

      <Body>
        <Gutter>
          <Card padding="5" marginBottom="6">
            {account ? (
              <Amount value={account.balance} size="display" verify />
            ) : (
              <Box height="62px" borderRadius="l2" bg="bg.muted" />
            )}

            {/*
              "전체 5천만 P 중 6.5%" 를 여기 두었다가 뺐다. 보유자가 그 숫자로 할 수 있는
              행동이 없다 — 내 지분을 안다고 더 보내거나 덜 보내지 않는다.
              유통량과 지분은 **발행자**의 판단 재료이므로 발행자 화면으로 옮긴다.
            */}
          </Card>
        </Gutter>

        <Gutter>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <SectionLabel>최근 보낸 사람</SectionLabel>
            {/* 내역은 자주 쓰는 행동이 아니다. 하단 버튼 자리를 뺏지 않게 여기 둔다. */}
            <chakra.button type="button" onClick={onOpenHistory} fontSize="sm" color="fg.muted">
              내역 ›
            </chakra.button>
          </Box>
        </Gutter>

        <Box marginTop="2" display="flex" flexDirection="column">
          {recent.slice(0, RECENT_LIMIT).map((user) => (
            <MotionButton
              key={user.id}
              type="button"
              whileTap={tap}
              onClick={() => onQuickPick(user)}
              display="flex"
              alignItems="center"
              gap="3"
              textAlign="left"
              paddingBlock="3"
              paddingInline="gutter"
              // 탭 하이라이트를 지웠으므로 눌림 상태를 명시적으로 만든다
              _active={{ bg: 'bg.muted' }}
            >
              <Box
                aria-hidden
                flexShrink={0}
                width="42px"
                height="42px"
                borderRadius="full"
                bg="bg.muted"
                color="fg.muted"
                display="grid"
                placeItems="center"
                fontSize="md"
                fontWeight="medium"
              >
                {user.name.slice(0, 1)}
              </Box>

              <Box flex={1} minW={0}>
                {/* 사람이 검증하는 것은 이름이다. 핸들은 검증 수단이 아니다. */}
                <Text textStyle="name">{user.name}</Text>
                <Text textStyle="handle">
                  {user.handle}
                </Text>
              </Box>

              <Box aria-hidden flexShrink={0} fontSize="xl" lineHeight="1" color="fg.subtle">
                ›
              </Box>
            </MotionButton>
          ))}
        </Box>
      </Body>

      <Footer>
        <MotionButton
          type="button"
          whileTap={tap}
          onClick={onOpenPicker}
          width="100%"
          minHeight="54px"
          borderRadius="l2"
          bg="blue.solid"
          color="blue.contrast"
          fontSize="md"
          fontWeight="medium"
        >
          다른 사람에게 보내기
        </MotionButton>

        {/*
          발행은 이체보다 되돌리기 어렵다. 그래서 색이 다르고, 남은 발행 여력을
          버튼에서 미리 보여준다. 그러나 별도 앱이나 숨은 메뉴로 분리하지는 않는다 —
          숨기면 발행 화면에 들어와 있다는 걸 모르는 상태가 생긴다.
        */}
        {isIssuer ? (
          <MotionButton
            type="button"
            whileTap={tap}
            onClick={onOpenIssue}
            marginTop="2"
            width="100%"
            minHeight="54px"
            borderRadius="l2"
            bg="transparent"
            borderWidth="1px"
            borderColor="issue.border"
            color="issue.fg"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="0.5"
            fontSize="md"
            fontWeight="medium"
          >
            <span>포인트 발행</span>
            <Text as="span" fontSize="xs" fontWeight="normal" color="fg.muted">
              남은 여력 {label(headroom).grouped} P
            </Text>
          </MotionButton>
        ) : null}
      </Footer>
    </Screen>
  )
}

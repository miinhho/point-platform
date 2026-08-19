import { Box, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/shared/format'
import type { Balance } from '@/api/contract'
import { Button } from '@chakra-ui/react'
import { IssuerSuffix } from '@/shared/ui/IssuerSuffix'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Row, RowButton } from '@/shared/ui/Screen'

interface Props {
  /** 잔액 0 이면 주지 않는다. 들어가면 첫 글자부터 잠긴 금액 화면이 된다 */
  onOpen?: () => void
  /** 은행 페이지로. 발행자든 아니든 판단할 것이 거기 있다 — 여정 10 */
  onBank: () => void
  balance: Balance
  isMine: boolean
}

/** 근거: docs/JOURNEY.md 여정 1 */
export function PointCard({ balance, isMine, onOpen, onBank }: Props) {
  const { t } = useTranslation()
  const { pointType, amount, sendable, neverSpent } = balance
  const empty = amount === 0
  // 나간 은행의 잔액은 그대로 남지만 쓸 수 없다. 조용히 두면 보낼 수 있다고 믿는다.
  const locked = !empty && sendable === 0
  const openable = !empty && !locked && onOpen
  // 방금 만든 포인트가 정확히 잔액 0 이라 흐려졌다 — 다음 할 일이 가장 확실한 카드였다.
  // 근거: docs/JOURNEY.md 여정 1
  const dimmed = (empty && !isMine) || locked
  // 카드 안에 버튼을 넣으면 HTML 이 깨지고, 무엇보다 카드의 접근성 이름에
  // 안쪽 버튼의 글자가 섞인다. 카드는 이체로 가는데 이름이 다른 행동을 말하게 된다.
  const Main = openable ? RowButton : Row

  return (
    <Box
      display="flex"
      alignItems="center"
      colorPalette={pointType.accent}
      opacity={dimmed ? 0.55 : 1}
    >
      <Main type={openable ? 'button' : undefined} onClick={openable ? onOpen : undefined} flex={1} minW={0}>
      <PointBadge emoji={pointType.emoji} />

      <Box flex={1} minW={0}>
        <Box display="flex" alignItems="baseline" gap="1.5">
          <Text textStyle="name">{pointType.name}</Text>
        </Box>
        <IssuerSuffix pointType={pointType} />
        {empty ? (
          <Text textStyle="caption">
            {t(isMine ? 'home.zeroBalanceIssuer' : 'home.zeroBalance')}
          </Text>
        ) : null}
        {locked ? <Text textStyle="caption">{t('home.locked')}</Text> : null}
        {/*
          내가 만든 은행은 낯설지 않다. 서버는 썼는지만 답하고, 그것이 판단 재료인지는
          화면이 정한다 — docs/JOURNEY.md 여정 10
        */}
        {!empty && !locked && !isMine && neverSpent ? (
          <Text textStyle="caption">{t('home.neverSpent')}</Text>
        ) : null}
      </Box>

        <Text textStyle="balance" flexShrink={0}>
          {toGrouped(amount)}
        </Text>
      </Main>

      {/* 형제로 둔다. 중첩하면 카드의 접근성 이름이 오염된다. */}
      {/* `2xs` 는 높이가 정확히 24px 이라 WCAG 2.5.8 최소치에 걸친다. 여유를 둔다. */}
      <Button
        size="xs"
        variant="outline"
        flexShrink={0}
        marginInlineEnd="gutter"
        aria-label={t('bank.entryFor', { name: pointType.name })}
        onClick={onBank}
      >
        {t('bank.entry')}
      </Button>
    </Box>
  )
}

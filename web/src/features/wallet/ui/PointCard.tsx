import { Box, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/shared/format'
import type { Balance } from '@/api/contract'
import { Button } from '@chakra-ui/react'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Row, RowButton } from '@/shared/ui/Screen'

interface Props {
  /** 잔액 0 이면 주지 않는다. 들어가면 첫 글자부터 잠긴 금액 화면이 된다 */
  onOpen?: () => void
  /** 발행 권한이 있을 때만. 여정 8 — 카드의 발행자 배지가 진입점이다 */
  onIssue?: () => void
  balance: Balance
  /** 이름이 겹치는 포인트다. 발행자를 부제로 붙인다 */
  ambiguous: boolean
  issuerName: string
  isMine: boolean
}

/** 근거: docs/JOURNEY.md 여정 1 */
export function PointCard({ balance, ambiguous, issuerName, isMine, onOpen, onIssue }: Props) {
  const { t } = useTranslation()
  const { pointType, amount } = balance
  const empty = amount === 0
  const openable = !empty && onOpen
  // 카드 안에 버튼을 넣으면 HTML 이 깨지고, 무엇보다 카드의 접근성 이름에
  // 안쪽 버튼의 글자가 섞인다. 카드는 이체로 가는데 이름이 "발행 관리" 를 말하게 된다.
  const Main = openable ? RowButton : Row

  return (
    <Box
      display="flex"
      alignItems="center"
      colorPalette={pointType.accent}
      opacity={empty ? 0.55 : 1}
    >
      <Main type={openable ? 'button' : undefined} onClick={openable ? onOpen : undefined} flex={1} minW={0}>
      <PointBadge symbol={pointType.symbol} />

      <Box flex={1} minW={0}>
        <Box display="flex" alignItems="baseline" gap="1.5">
          <Text textStyle="name">{pointType.name}</Text>
        </Box>
        {ambiguous ? (
          <Text textStyle="caption">{t('home.issuedBy', { name: issuerName })}</Text>
        ) : null}
        {empty ? <Text textStyle="caption">{t('home.zeroBalance')}</Text> : null}
      </Box>

        <Text textStyle="balance" flexShrink={0}>
          {toGrouped(amount)}
        </Text>
      </Main>

      {/* 형제로 둔다. 중첩하면 카드의 접근성 이름이 오염된다. */}
      {isMine && onIssue ? (
        // `2xs` 는 높이가 정확히 24px 이라 WCAG 2.5.8 최소치에 걸친다. 여유를 둔다.
        <Button
          size="xs"
          variant="outline"
          flexShrink={0}
          marginInlineEnd="gutter"
          onClick={onIssue}
        >
          {t('home.issue')}
        </Button>
      ) : null}
    </Box>
  )
}

import { Box, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/domain/points'
import type { Balance } from '@/domain/types'
import { chakra } from '@chakra-ui/react'
import { Row, RowButton } from '@/shared/ui/Screen'

const IssueEntry = chakra('button', {
  base: {
    flexShrink: 0,
    paddingInline: '2',
    paddingBlock: '0.5',
    borderRadius: 'full',
    textStyle: 'verifyLabel',
    borderWidth: '1px',
    borderColor: 'verify.fg',
    _active: { bg: 'verify.subtle' },
  },
})

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
  const Container = empty || !onOpen ? Row : RowButton

  return (
    <Container
      type={empty || !onOpen ? undefined : 'button'}
      onClick={empty ? undefined : onOpen}
      colorPalette={pointType.accent}
      opacity={empty ? 0.55 : 1}
    >
      {/* 색과 기호를 함께 준다. 회색조에서도 기호로 갈린다. */}
      <Box
        aria-hidden
        flexShrink={0}
        boxSize="avatar"
        borderRadius="l2"
        bg="colorPalette.subtle"
        color="colorPalette.fg"
        borderWidth="1px"
        borderColor="colorPalette.muted"
        display="grid"
        placeItems="center"
        textStyle="badge"
      >
        {pointType.symbol}
      </Box>

      <Box flex={1} minW={0}>
        <Box display="flex" alignItems="baseline" gap="1.5">
          <Text textStyle="name">{pointType.name}</Text>
          {isMine && onIssue ? (
            <IssueEntry
              type="button"
              onClick={(event) => {
                // 카드는 보내기로 간다. 배지만 발행으로 갈라진다.
                event.stopPropagation()
                onIssue()
              }}
            >
              {t('home.issue')}
            </IssueEntry>
          ) : null}
        </Box>
        {ambiguous ? (
          <Text textStyle="caption">{t('home.issuedBy', { name: issuerName })}</Text>
        ) : null}
        {empty ? <Text textStyle="caption">{t('home.zeroBalance')}</Text> : null}
      </Box>

      <Text textStyle="balance" flexShrink={0}>
        {toGrouped(amount)}
      </Text>
    </Container>
  )
}

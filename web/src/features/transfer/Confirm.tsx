import { Box, Text, chakra } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { recentQuery, walletQuery } from '@/api/queries'
import { formatRate, inflationRate } from '@/domain/ledger'
import { toGrouped } from '@/domain/points'
import { BackButton } from '@/shared/ui/BackButton'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { HoldButton } from '@/shared/ui/HoldButton'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { Amount } from './Amount'
import { draftAtom } from './atoms'
import { amountOf } from './draft'
import type { PointType } from '@/domain/types'

const Card = chakra('div', {
  base: {
    bg: 'bg.panel',
    borderRadius: 'l3',
    borderWidth: '1px',
    borderColor: 'border',
    padding: '5',
  },
})

interface Props {
  onBack: () => void
  onConfirm: () => void
  /** 요청이 나가는 중. 홀드를 두 번 완료해도 두 번 보내지 않는다 */
  busy: boolean
}

/** 근거: docs/JOURNEY.md 여정 5 — 이 화면이 마지막 방어선이다 */
export function Confirm({ onBack, onConfirm, busy }: Props) {
  const { t } = useTranslation()
  const draft = useAtomValue(draftAtom)
  const wallet = useQuery(walletQuery())
  const recent = useQuery({ ...recentQuery(draft?.pointType.id ?? ''), enabled: !!draft })

  if (!draft?.to) return null

  const issuing = draft.kind === 'issue'
  const amount = amountOf(draft)
  const balance =
    wallet.data?.balances.find((b) => b.pointType.id === draft.pointType.id)?.amount ?? 0
  // 처음 받는 사람인가. 경고가 아니라 사실로 한 줄 적는다.
  const firstTime =
    !issuing && recent.data ? !recent.data.some((user) => user.id === draft.to?.id) : false

  return (
    <Screen>
      {issuing ? <IssueBanner /> : null}
      <Header>
        <BackButton onClick={onBack} />
        <Title>{issuing ? t('confirm.titleIssue') : t('confirm.titleTransfer')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          <Card>
            {issuing ? null : (
              <>
                <Text textStyle="caption">{t('confirm.to')}</Text>
                <Box display="flex" alignItems="baseline" gap="2" marginTop="1" marginBottom="5">
                  <Text textStyle="name">{draft.to.name}</Text>
                  <Text textStyle="handle">{draft.to.handle}</Text>
                </Box>
              </>
            )}

            <Amount pointType={draft.pointType} amount={amount} />

            <Box
              marginTop="5"
              paddingTop="4"
              borderTopWidth="1px"
              borderColor="border"
              display="flex"
              flexDirection="column"
              gap="2"
            >
              {issuing ? (
                <Supply pointType={draft.pointType} amount={amount} />
              ) : (
                <>
                  <Line label={t('confirm.balanceNow')} value={toGrouped(balance)} />
                  <Line
                    label={t('confirm.balanceAfter')}
                    value={toGrouped(balance - amount)}
                    strong
                  />
                  {firstTime ? <Text textStyle="caption">{t('confirm.firstTime')}</Text> : null}
                </>
              )}
            </Box>
          </Card>
        </Gutter>
      </Body>

      <Gutter paddingTop="3" paddingBottom="4">
        <Box colorPalette={draft.pointType.accent}>
          <HoldButton
            label={issuing ? t('confirm.holdIssue') : t('confirm.holdTransfer')}
            onComplete={onConfirm}
            disabled={busy}
          />
        </Box>
      </Gutter>
    </Screen>
  )
}

/** 발행이 되돌릴 수 없게 만드는 것은 잔액이 아니라 유통량이다 */
function Supply({ pointType, amount }: { pointType: PointType; amount: number }) {
  const { t } = useTranslation()
  const after = pointType.totalIssued + amount
  const rate = inflationRate(amount, pointType.totalIssued)

  return (
    <>
      <Line label={t('confirm.supplyNow')} value={toGrouped(pointType.totalIssued)} />
      <Line label={t('confirm.supplyAfter')} value={toGrouped(after)} strong />
      <Line
        label={t('confirm.supplyChange')}
        value={rate === null ? t('confirm.supplyFirst') : `+${formatRate(rate)}`}
      />
      <Line label={t('confirm.cap')} value={toGrouped(pointType.issueCap)} />
    </>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box display="flex" alignItems="baseline" justifyContent="space-between" gap="3">
      <Text textStyle="caption">{label}</Text>
      <Text textStyle={strong ? 'lineStrong' : 'line'}>{value}</Text>
    </Box>
  )
}

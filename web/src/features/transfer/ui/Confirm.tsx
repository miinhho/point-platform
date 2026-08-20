import { Box, Text, VisuallyHidden, chakra } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { recentQuery, walletQuery } from '@/shared/api'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { HoldButton } from '@/shared/ui/HoldButton'
import { Line } from '@/shared/ui/Line'
import { LineSkeleton, Loadable } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { Amount } from './Amount'
import { draftAtom } from '../model/atoms'
import { amountOf } from '../model/draft'
import { formatRate, inflationRate } from '../model/inflation'
import type { PointType } from '@/shared/contract'

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
  const held = wallet.data?.balances.find((b) => b.pointType.id === draft.pointType.id)
  /*
   * 못 불러온 잔액을 0 으로 접으면 「보낸 뒤 남는 잔액」이 음수가 된다 — 되돌릴 수
   * 없는 것 직전에 화면이 거짓을 말한다. 답하지 못하는 동안은 숫자를 쓰지 않는다.
   */
  const balance = wallet.isSuccess ? (held?.amount ?? 0) : null
  // 상한 판정은 서버가 한다. 여기서는 보낸 뒤의 값을 보여주기만 한다.
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
                  {balance === null ? (
                    <Loadable
                      pending={wallet.isPending}
                      failed={wallet.isError}
                      onRetry={() => void wallet.refetch()}
                      label={t('home.loadFailed')}
                      skeleton={
                        <Box display="flex" flexDirection="column" gap="3">
                          <LineSkeleton />
                          <LineSkeleton />
                        </Box>
                      }
                    >
                      {null}
                    </Loadable>
                  ) : (
                    <>
                      <Line label={t('confirm.balanceNow')} value={toGrouped(balance)} />
                      <Line
                        label={t('confirm.balanceAfter')}
                        value={toGrouped(balance - amount)}
                        textStyle="lineStrong"
                      />
                    </>
                  )}
                  {firstTime ? <Text textStyle="caption">{t('confirm.firstTime')}</Text> : null}
                </>
              )}
            </Box>

            {/* 공개 은행에는 관문이 없다. 대가로 무언가를 주기 직전이 마지막 방어선이다 */}
            {!issuing && held?.neverSpent ? <FirstUse pointType={draft.pointType} /> : null}
          </Card>
        </Gutter>
      </Body>

      <Gutter paddingTop="3" paddingBottom="4">
        {/* 화면은 그대로 두고 버튼만 잠긴다. 그 사실이 소리로도 닿아야 한다 */}
        <VisuallyHidden aria-live="polite">
          {busy ? t(issuing ? 'confirm.sendingIssue' : 'confirm.sendingTransfer') : ''}
        </VisuallyHidden>
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

/**
 * 이 포인트를 처음 쓴다. 판단의 근거는 핸들이다 — 이름도 기호도 색도 흉내낼 수
 * 있고 핸들만 하나뿐이다. 근거: docs/JOURNEY.md 여정 10
 */
function FirstUse({ pointType }: { pointType: PointType }) {
  const { t } = useTranslation()

  return (
    <Box marginTop="4" paddingTop="4" borderTopWidth="1px" borderColor="border">
      <Text textStyle="support">{t('confirm.firstUse')}</Text>
      <Box marginTop="2">
        <Line label={t('confirm.firstUseIssuer')} value={pointType.issuerHandle} textStyle="mono" />
      </Box>
    </Box>
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
      <Line label={t('confirm.supplyAfter')} value={toGrouped(after)} textStyle="lineStrong" />
      <Line
        label={t('confirm.supplyChange')}
        value={rate === null ? t('confirm.supplyFirst') : `+${formatRate(rate)}`}
      />
      <Line label={t('confirm.cap')} value={toGrouped(pointType.issueCap)} />
    </>
  )
}

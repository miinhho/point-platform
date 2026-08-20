import { Box, Text, VisuallyHidden } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { recentQuery, walletQuery } from '@/shared/api'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { HoldButton } from '@/shared/ui/HoldButton'
import { Line } from '@/shared/ui/Line'
import { LineSkeleton, Loadable } from '@/shared/ui/Loadable'
import { Body, Footer, Gutter, Header, Panel, Screen, Title } from '@/shared/ui/Screen'
import type { PointType } from '@/shared/contract'
import { Amount } from '../ui/Amount'
import { amountOf, type SealedDraft } from '../model/flow'

interface Props {
  draft: SealedDraft
  onBack: () => void
  onConfirm: () => void
  /** 요청이 나가는 중. 홀드를 두 번 완료해도 두 번 보내지 않는다 */
  busy: boolean
}

/**
 * 목적: 누구에게 얼마가 나가는지 마지막으로 맞춰 본다.
 *
 * 주의는 받는 사람 → 금액 → 보낸 뒤 남는 잔액 순으로 옮겨 가고, 되돌릴 수 없는
 * 확정은 꾹 누르는 것 하나뿐이다. 근거: docs/JOURNEY.md 여정 5
 */
export function ConfirmTransfer({ draft, onBack, onConfirm, busy }: Props) {
  const { t } = useTranslation()
  const wallet = useQuery(walletQuery())
  const recent = useQuery(recentQuery(draft.pointType.id))

  const amount = amountOf(draft)
  const held = wallet.data?.balances.find((b) => b.pointType.id === draft.pointType.id)
  /*
   * 못 불러온 잔액을 0 으로 접으면 「보낸 뒤 남는 잔액」이 음수가 된다 — 되돌릴 수
   * 없는 것 직전에 화면이 거짓을 말한다. 답하지 못하는 동안은 숫자를 쓰지 않는다.
   */
  const balance = wallet.isSuccess ? (held?.amount ?? 0) : null
  // 처음 받는 사람인가. 경고가 아니라 사실로 한 줄 적는다.
  const firstTime = recent.data ? !recent.data.some((user) => user.id === draft.to.id) : false

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('confirm.titleTransfer')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="inset">
          <Panel raised>
            <Text textStyle="caption">{t('confirm.to')}</Text>
            <Box display="flex" alignItems="baseline" gap="tight" marginTop="bond" marginBottom="block">
              <Text textStyle="name">{draft.to.name}</Text>
              <Text textStyle="handle">{draft.to.handle}</Text>
            </Box>

            <Amount pointType={draft.pointType} amount={amount} />

            <Box
              marginTop="block"
              paddingTop="inset"
              borderTopWidth="1px"
              borderColor="border"
              display="flex"
              flexDirection="column"
              gap="tight"
            >
              {balance === null ? (
                <Loadable
                  pending={wallet.isPending}
                  failed={wallet.isError}
                  onRetry={() => void wallet.refetch()}
                  label={t('home.loadFailed')}
                  skeleton={
                    <Box display="flex" flexDirection="column" gap="side">
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
            </Box>

            {/* 공개 은행에는 관문이 없다. 대가로 무언가를 주기 직전이 마지막 방어선이다 */}
            {held?.neverSpent ? <FirstUse pointType={draft.pointType} /> : null}
          </Panel>
        </Gutter>
      </Body>

      <Footer>
        {/* 화면은 그대로 두고 버튼만 잠긴다. 그 사실이 소리로도 닿아야 한다 */}
        <VisuallyHidden aria-live="polite">{busy ? t('confirm.sendingTransfer') : ''}</VisuallyHidden>
        <Box colorPalette={draft.pointType.accent}>
          <HoldButton label={t('confirm.holdTransfer')} onComplete={onConfirm} disabled={busy} />
        </Box>
      </Footer>
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
    <Box marginTop="inset" paddingTop="inset" borderTopWidth="1px" borderColor="border">
      <Text textStyle="support">{t('confirm.firstUse')}</Text>
      <Box marginTop="tight">
        <Line label={t('confirm.firstUseIssuer')} value={pointType.issuerHandle} textStyle="mono" />
      </Box>
    </Box>
  )
}

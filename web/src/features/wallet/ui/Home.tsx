import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { startTransferAtom } from '@/features/transfer'
import { goAtom } from '@/app/atoms'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { orderBalances } from '../model/order'
import { PointCard } from './PointCard'

/** 근거: docs/JOURNEY.md 여정 1 */
export function Home() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useQuery(walletQuery())
  const startTransfer = useSetAtom(startTransferAtom)
  const go = useSetAtom(goAtom)

  const balances = data ? orderBalances(data.balances) : []

  return (
    <Screen>
      <Header>
        <Title>{t('home.title')}</Title>
      </Header>

      <Body>
        {/* 상태 변화는 소리로도 전달된다 — docs/JOURNEY.md. 특히 실패는 오래 머문다 */}
        {isPending ? <Note role="status">{t('common.loading')}</Note> : null}
        {isError ? <Note role="alert">{t('home.loadFailed')}</Note> : null}
        {data?.balances.length === 0 ? <Note>{t('home.empty')}</Note> : null}

        {balances.map((balance) => (
          <PointCard
            key={balance.pointType.id}
            balance={balance}
            nameIsShared={balance.pointType.nameIsShared}
            issuerName={balance.pointType.issuerName}
            isMine={balance.pointType.canIssue}
            onOpen={() => startTransfer({ pointType: balance.pointType })}
            onIssue={balance.pointType.canIssue ? () => go({ name: 'issuer' }) : undefined}
          />
        ))}

        {/* 목록 끝에 둔다 — 계좌 목록 아래의 「계좌 개설」과 같은 자리다 */}
        {data ? (
          <Gutter paddingTop="4" paddingBottom="6">
            <Button
              size="lg"
              width="full"
              variant="outline"
              onClick={() => go({ name: 'createPoint' })}
            >
              {t('create.entry')}
            </Button>
          </Gutter>
        ) : null}
      </Body>
    </Screen>
  )
}

function Note({ children, role }: { children: string; role?: 'status' | 'alert' }) {
  return (
    <Gutter>
      <Box role={role} paddingBlock="8">
        <Text textStyle="caption" textAlign="center">
          {children}
        </Text>
      </Box>
    </Gutter>
  )
}

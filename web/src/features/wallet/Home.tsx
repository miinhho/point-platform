import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { startIssueAtom, startTransferAtom } from '@/features/transfer/atoms'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { duplicatedNames, orderBalances } from './order'
import { PointCard } from './PointCard'

/** 근거: docs/JOURNEY.md 여정 1 */
export function Home() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useQuery(walletQuery())
  const startTransfer = useSetAtom(startTransferAtom)
  const startIssue = useSetAtom(startIssueAtom)

  const balances = data ? orderBalances(data.balances) : []
  const ambiguous = duplicatedNames(balances)

  return (
    <Screen>
      <Header>
        <Title>{t('home.title')}</Title>
      </Header>

      <Body>
        {isPending ? <Note>{t('common.loading')}</Note> : null}
        {isError ? <Note>{t('home.loadFailed')}</Note> : null}
        {data?.balances.length === 0 ? <Note>{t('home.empty')}</Note> : null}

        {balances.map((balance) => (
          <PointCard
            key={balance.pointType.id}
            balance={balance}
            ambiguous={ambiguous.has(balance.pointType.name)}
            issuerName={balance.pointType.issuerName}
            isMine={balance.pointType.issuerId === data?.user.id}
            onOpen={() => startTransfer({ pointType: balance.pointType })}
            onIssue={
              data && balance.pointType.issuerId === data.user.id
                ? () => startIssue({ pointType: balance.pointType, me: data.user })
                : undefined
            }
          />
        ))}
      </Body>
    </Screen>
  )
}

function Note({ children }: { children: string }) {
  return (
    <Gutter>
      <Box paddingBlock="8">
        <Text textStyle="caption" textAlign="center">
          {children}
        </Text>
      </Box>
    </Gutter>
  )
}

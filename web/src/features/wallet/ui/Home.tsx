import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { invitesQuery, walletQuery } from '@/api/queries'
import { startTransferAtom } from '@/features/transfer'
import { goAtom } from '@/app/atoms'
import { Body, Gutter, Header, RowButton, Screen, Title } from '@/shared/ui/Screen'
import { PointBadge } from '@/shared/ui/PointBadge'
import type { Invite } from '@/api/contract'
import { orderBalances } from '../model/order'
import { PointCard } from './PointCard'

/** 근거: docs/JOURNEY.md 여정 1 */
export function Home() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useQuery(walletQuery())
  const invites = useQuery(invitesQuery())
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
        {data?.balances.length === 0 && invites.data?.length === 0 ? (
          <Note>{t('home.empty')}</Note>
        ) : null}

        {/* 초대를 열면 은행 페이지가 열린다. 판단할 것은 거기 다 있다 — 여정 10 */}
        {invites.data?.length ? (
          <>
            <Gutter paddingTop="3" paddingBottom="1">
              <Text textStyle="caption">{t('home.invites')}</Text>
            </Gutter>
            {invites.data.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onOpen={() => go({ name: 'bank', pointTypeId: invite.pointType.id })}
              />
            ))}
          </>
        ) : null}

        {balances.map((balance) => (
          <PointCard
            key={balance.pointType.id}
            balance={balance}
            isMine={balance.pointType.canIssue}
            onOpen={() => startTransfer({ pointType: balance.pointType })}
            onBank={() => go({ name: 'bank', pointTypeId: balance.pointType.id })}
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

/** 판단은 여기서 하지 않는다. 무엇인지 말하고 은행 페이지로 보낸다 */
function InviteRow({ invite, onOpen }: { invite: Invite; onOpen: () => void }) {
  const { t } = useTranslation()
  const { pointType } = invite

  return (
    <RowButton type="button" onClick={onOpen} colorPalette={pointType.accent}>
      <PointBadge symbol={pointType.symbol} />
      <Box flex={1} minW={0}>
        <Text textStyle="name">{pointType.name}</Text>
        <Text textStyle="caption">{t('home.invitedBy', { handle: invite.byHandle })}</Text>
      </Box>
    </RowButton>
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

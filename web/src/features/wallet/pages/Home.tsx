import { Box, Button, Text } from '@chakra-ui/react'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { startTransferAtom } from '@/features/transfer'
import { goAtom } from '@/app/atoms'
import { Loadable, RowSkeleton } from '@/shared/ui/Loadable'
import {
  Body,
  Header,
  ListAction,
  Note,
  RowButton,
  Screen,
  SectionLabel,
  Title,
} from '@/shared/ui/Screen'
import { PointBadge } from '@/shared/ui/PointBadge'
import type { Invite } from '@/shared/contract'
import { useWalletPage } from '../model/useWalletPage'
import { PointCard } from '../ui/PointCard'

/** 근거: docs/JOURNEY.md 여정 1 */
export function Home() {
  const { t } = useTranslation()
  const { pending, failed, retry, loaded, balances, invites, empty } = useWalletPage()
  const startTransfer = useSetAtom(startTransferAtom)
  const go = useSetAtom(goAtom)

  return (
    <Screen>
      <Header>
        <Title>{t('home.title')}</Title>
      </Header>

      <Body>
        {/* 못 불러온 것이 「아직 없어요」와 같아 보이면 여정 1 의 노력이 무너진다 */}
        <Loadable
          pending={pending}
          failed={failed}
          onRetry={retry}
          label={t('home.loadFailed')}
          skeleton={
            // 카드 넷: 배지 · 이름과 부제 · 오른쪽 잔액. 시드가 그만큼 온다
            <>
              {[0, 1, 2, 3].map((row) => (
                <RowSkeleton key={row} avatar trailing="88px" />
              ))}
            </>
          }
        >
          {empty ? <Note>{t('home.empty')}</Note> : null}

          {/* 초대를 열면 은행 페이지가 열린다. 판단할 것은 거기 다 있다 — 여정 10 */}
          {invites.length > 0 ? (
            <>
              <SectionLabel>{t('home.invites')}</SectionLabel>
              {invites.map((invite) => (
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

        </Loadable>

        {/*
          홈에는 하단에 고정되는 행동이 없다. 이 화면의 주된 행동은 카드를 고르는
          것이고, 포인트 만들기는 목록을 다 본 사람의 다음 할 일이다.
        */}
        {loaded ? (
          <ListAction>
            <Button
              size="lg"
              width="full"
              variant="outline"
              onClick={() => go({ name: 'createPoint' })}
            >
              {t('create.entry')}
            </Button>
          </ListAction>
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
      <PointBadge emoji={pointType.emoji} />
      <Box flex={1} minW={0}>
        <Text textStyle="name">{pointType.name}</Text>
        <Text textStyle="caption">{t('home.invitedBy', { handle: invite.byHandle })}</Text>
      </Box>
    </RowButton>
  )
}


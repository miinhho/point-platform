import { Box, Input, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { PointTypeId, User } from '@/shared/contract'
import { BackButton } from '@/shared/ui/BackButton'
import { Loadable, RowSkeleton } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, Note, Row, RowButton, Screen, Title } from '@/shared/ui/Screen'
import { useBankGate } from '../model/useBankGate'
import { useInvitePage } from '../model/useInvitePage'

interface Props {
  pointTypeId: PointTypeId
  onBack: () => void
}

/**
 * 초대. 은행장만 한다 — docs/JOURNEY.md 여정 10.
 *
 * **이미 회원인 사람은 후보에서 뺀다.** 초대할 수 없는 사람을 눌러 볼 수 있게 두면
 * 정상 경로에서 `ALREADY_MEMBER` 를 만나게 된다 — 그건 겹쳐 들어온 경우에만 나오는
 * 막다른 답이다. 계약: docs/API.md
 */
export function Invite({ pointTypeId, onBack }: Props) {
  const { t } = useTranslation()
  const { query, setQuery, candidates, invited, invite, busy, pending, failed, retry } =
    useInvitePage(pointTypeId)
  // 초대는 은행장만 한다. 막혀 있으면 은행 페이지로 대체한다 — docs/REBUILD.md 「주소」
  useBankGate(pointTypeId, 'issuer')

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('bank.inviteTitle')}</Title>
      </Header>

      <Gutter>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('pick.searchPlaceholder')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          size="lg"
          borderRadius="panel"
          bg="bg.panel"
        />
      </Gutter>

      <Body marginTop="tight">
        {/* 못 불러온 것을 「그런 사람이 없어요」로 두면 초대할 수 없는 이유를 오해한다 */}
        <Loadable
          pending={pending}
          failed={failed}
          onRetry={retry}
          label={t('pick.loadFailed')}
          skeleton={
            <>
              {[0, 1, 2, 3].map((row) => (
                <RowSkeleton key={row} />
              ))}
            </>
          }
        >
          {candidates.map((user) =>
            invited.has(user.id) ? (
              <Candidate key={user.id} user={user} note={t('bank.invited')} />
            ) : (
              <Candidate key={user.id} user={user} onInvite={() => invite(user.id)} busy={busy} />
            ),
          )}

          {candidates.length === 0 ? (
            <Note>{t('pick.notFound', { query: query.trim() })}</Note>
          ) : null}
        </Loadable>
      </Body>
    </Screen>
  )
}

interface CandidateProps {
  user: User
  note?: string
  onInvite?: () => void
  busy?: boolean
}

function Candidate({ user, note, onInvite, busy }: CandidateProps) {
  const body = (
    <>
      <Box flex={1} minW={0}>
        <Text textStyle="name">{user.name}</Text>
        <Text
          textStyle={user.nameIsShared ? 'handleVerify' : 'handle'}
          color={user.nameIsShared ? 'verify.fg' : undefined}
        >
          {user.handle}
        </Text>
      </Box>
      {note ? (
        <Text textStyle="caption" flexShrink={0}>
          {note}
        </Text>
      ) : null}
    </>
  )

  return onInvite ? (
    <RowButton type="button" onClick={onInvite} disabled={busy}>
      {body}
    </RowButton>
  ) : (
    <Row opacity={0.55}>{body}</Row>
  )
}

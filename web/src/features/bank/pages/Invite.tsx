import { Box, Input, Text } from '@chakra-ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invitesApi, newIdempotencyKey, usersQuery } from '@/shared/api'
import type { PointTypeId, User, UserId } from '@/shared/contract'
import { BackButton } from '@/shared/ui/BackButton'
import { Body, Gutter, Header, Row, RowButton, Screen, Title } from '@/shared/ui/Screen'

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
  const [query, setQuery] = useState('')

  const everyone = useQuery(usersQuery(query.trim()))
  // 회원 판정은 서버가 한다. 같은 규칙을 화면이 다시 계산하지 않는다.
  const members = useQuery(usersQuery('', pointTypeId))
  const memberIds = new Set(members.data?.map((user) => user.id))
  // 회원 판정은 서버가 한다. 화면은 그 답으로 후보를 거를 뿐이다.
  const candidates = (everyone.data ?? []).filter((user) => !memberIds.has(user.id))

  const [invited, setInvited] = useState<ReadonlySet<UserId>>(new Set())

  const invite = useMutation({
    mutationFn: (toId: UserId) => invitesApi.createInvite(pointTypeId, toId, newIdempotencyKey()),
    retry: false,
    // 보낸 초대를 되읽는 길이 계약에 없다. 이 화면에 머무는 동안만 기억한다.
    onSuccess: (_created, toId) => {
      setInvited((previous) => new Set([...previous, toId]))
    },
  })

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
        {candidates.map((user) =>
          invited.has(user.id) ? (
            <Candidate key={user.id} user={user} note={t('bank.invited')} />
          ) : (
            <Candidate
              key={user.id}
              user={user}
              onInvite={() => invite.mutate(user.id)}
              busy={invite.isPending}
            />
          ),
        )}

        {candidates.length === 0 ? (
          <Gutter>
            <Text textStyle="caption" paddingBlock="part" textAlign="center">
              {t('pick.notFound', { query: query.trim() })}
            </Text>
          </Gutter>
        ) : null}
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

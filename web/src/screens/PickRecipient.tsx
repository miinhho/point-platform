import { Box, Input, Text } from '@chakra-ui/react'
import { buildRecipientList, buildSearchList, type RecipientEntry } from '@/api/recipientList'
import { useUserSearch } from '@/api/useUserSearch'
import { BackButton } from '@/ui/BackButton'
import { MotionButton, useTapScale } from '@/ui/motion'
import { Body, Gutter, Header, HeaderTitle, Screen, SectionLabel } from '@/ui/Screen'
import type { TransferKind, User } from '@/domain/types'

interface Props {
  kind: TransferKind
  query: string
  onQuery: (query: string) => void
  onPick: (to: User) => void
  onBack: () => void
}

/**
 * 대상 선택 (여정 2 — 받는 사람을 고른다).
 *
 * 사용자는 머릿속의 사람을 화면에서 찾는다. 계좌번호는 인간이 검증할 수 없는
 * 문자열이라서 이 앱에는 없고, 대신 이름으로 찾는다.
 *
 * 그런데 이름은 겹친다. 원장에 김지수가 두 명 있는 것은 그 위험을 재현하기
 * 위한 것이고, 이 화면이 그것을 처리하지 못하면 앱 전체가 실패한다.
 * 목록을 어떻게 쌓는지는 `api/recipientList.ts` 에 따로 두었다 — 최근 묶음과
 * 동명이인 인접이 부딪히는 자리라서, 화면 안에 섞어 두면 검증할 수 없다.
 */
export function PickRecipient({ kind, query, onQuery, onPick, onBack }: Props) {
  const { users, recent, pending } = useUserSearch(query)
  const tap = useTapScale()
  const searching = query.trim().length > 0
  const list = searching ? buildSearchList(users) : buildRecipientList(recent, users)

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <HeaderTitle>{kind === 'issue' ? '누구에게 발행할까' : '누구에게 보낼까'}</HeaderTitle>
      </Header>

      <Gutter>
        {/*
          자동 포커스를 넣었다가 뺐다. 키보드가 올라오면 목록에 남는 세로가
          286 CSS px (전체의 37%) 뿐이라 다섯 명 중 두 명만 보였다. 동명이인 묶음이
          목록 아래쪽에 있으면 **두 줄을 나란히 볼 수 없다** — 이 화면의 존재 이유가
          거기 있는데 자동 포커스가 그것을 가렸다.
        */}
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="이름 또는 핸들"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          size="lg"
          borderRadius="l2"
          bg="bg.panel"
        />
      </Gutter>

      <Body marginTop="2">
        {list.recent.length > 0 ? (
          <>
            <Gutter paddingBottom="1">
              <SectionLabel>최근 보낸 사람</SectionLabel>
            </Gutter>
            <Rows entries={list.recent} list={list} tap={tap} onPick={onPick} />
          </>
        ) : null}

        {list.others.length > 0 ? (
          <>
            {list.recent.length > 0 ? (
              <Gutter paddingTop="4" paddingBottom="1">
                <SectionLabel>전체</SectionLabel>
              </Gutter>
            ) : null}
            <Rows entries={list.others} list={list} tap={tap} onPick={onPick} />
          </>
        ) : null}

        {!pending && list.recent.length + list.others.length === 0 ? (
          <Gutter>
            <Text marginTop="6" fontSize="sm" color="fg.muted">
              {searching ? `"${query.trim()}" 로 찾은 사람이 없다.` : '보낼 수 있는 사람이 없다.'}
            </Text>
          </Gutter>
        ) : null}
      </Body>
    </Screen>
  )
}

interface RowsProps {
  entries: RecipientEntry[]
  list: { countByName: Map<string, number> }
  tap: { scale: number } | undefined
  onPick: (to: User) => void
}

function Rows({ entries, list, tap, onPick }: RowsProps) {
  return (
    <>
      {entries.map((entry, index) => {
        // 겹치는 이름 묶음의 첫 줄에만 안내를 붙인다. 화면 상단에 배너로 띄우면
        // 목록에 갈 때마다 보이게 되고, 늘 보이는 경고는 곧 배경이 된다.
        const startsCluster =
          entry.ambiguous && entries[index - 1]?.user.name !== entry.user.name

        return (
          <Box key={entry.user.id}>
            {startsCluster ? (
              <Gutter paddingTop="3" paddingBottom="1">
                <Text fontSize="xs" fontWeight="medium" color="orange.fg">
                  같은 이름 {list.countByName.get(entry.user.name)}명 · 핸들로 구분한다
                </Text>
              </Gutter>
            ) : null}
            <RecipientRow entry={entry} tap={tap} onPick={onPick} />
          </Box>
        )
      })}
    </>
  )
}

interface RowProps {
  entry: RecipientEntry
  tap: { scale: number } | undefined
  onPick: (to: User) => void
}

function RecipientRow({ entry, tap, onPick }: RowProps) {
  const { user, ambiguous, pulledUp } = entry

  return (
    <MotionButton
      type="button"
      whileTap={tap}
      onClick={() => onPick(user)}
      display="flex"
      alignItems="center"
      gap="3"
      width="100%"
      textAlign="left"
      paddingBlock="3"
      paddingInline="gutter"
      _active={{ bg: 'bg.muted' }}
    >
      <Box
        aria-hidden
        flexShrink={0}
        width="42px"
        height="42px"
        borderRadius="full"
        bg="bg.muted"
        color="fg.muted"
        display="grid"
        placeItems="center"
        fontSize="md"
        fontWeight="medium"
      >
        {user.name.slice(0, 1)}
      </Box>

      <Box flex={1} minW={0}>
        <Box display="flex" alignItems="baseline" gap="2">
          <Text textStyle="name">{user.name}</Text>
          {/*
            비교하라고 최근 묶음으로 끌어올린 줄. 이 표시가 없으면
            "최근 보낸 사람"이라는 제목이 거짓말이 된다.
          */}
          {pulledUp ? (
            <Text fontSize="xs" color="fg.muted" flexShrink={0}>
              보낸 적 없음
            </Text>
          ) : null}
        </Box>
        {/*
          평소 핸들은 계좌번호 역할이라 이름보다 작다. 그런데 이름이 겹치는 순간에는
          핸들이 유일한 구별 수단이 되므로, 그때만 크기·굵기·색을 함께 올린다.
          셋을 함께 바꾸는 것은 색만으로 구분하지 않기 위해서다.
        */}
        <Text
          textStyle="handle"
          fontSize={ambiguous ? 'md' : 'sm'}
          fontWeight={ambiguous ? 'medium' : 'normal'}
          color={ambiguous ? 'orange.fg' : undefined}
        >
          {user.handle}
        </Text>
      </Box>

      <Box aria-hidden flexShrink={0} fontSize="xl" lineHeight="1" color="fg.muted">
        ›
      </Box>
    </MotionButton>
  )
}

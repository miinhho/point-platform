import { Box, Input, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { recentQuery, usersQuery } from '@/api/queries'
import { BackButton } from '@/shared/ui/BackButton'
import { IssuerSuffix } from '@/shared/ui/IssuerSuffix'
import { Loadable, RowsSkeleton } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, RowButton, Screen, Title } from '@/shared/ui/Screen'
import { draftAtom, pickRecipientAtom } from '../model/atoms'
import { buildRecipientList, buildSearchList, type RecipientEntry } from '../model/recipientList'

/** 근거: docs/JOURNEY.md 여정 3 */
export function PickRecipient({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const draft = useAtomValue(draftAtom)
  const pick = useSetAtom(pickRecipientAtom)
  // 검색어는 서버 상태가 아니고 다른 화면이 알 필요도 없다.
  const [query, setQuery] = useState('')

  const searching = query.trim().length > 0
  // 비공개 은행이면 회원만 온다. 목록에 없는 사람에게는 보낼 수도 없다.
  const users = useQuery(usersQuery(query.trim(), draft?.pointType.id))
  const recent = useQuery({ ...recentQuery(draft?.pointType.id ?? ''), enabled: !!draft })

  const list = searching
    ? buildSearchList(users.data ?? [])
    : buildRecipientList(recent.data ?? [], users.data ?? [])
  const total = list.recent.length + list.others.length

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('pick.titleTransfer')}</Title>
        {draft ? (
          <Box display="flex" alignItems="baseline" gap="1.5" flexWrap="wrap">
            <Text textStyle="caption" colorPalette={draft.pointType.accent} color="colorPalette.fg">
              {draft.pointType.name}
            </Text>
            <IssuerSuffix pointType={draft.pointType} />
          </Box>
        ) : null}
      </Header>

      {/* 자동 포커스를 두지 않는다 — 키보드가 목록의 3분의 2를 덮는다 (FIELD.md R2) */}
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
          borderRadius="l2"
          bg="bg.panel"
        />
      </Gutter>

      <Body marginTop="2">
        <Loadable
          pending={users.isPending}
          failed={users.isError}
          onRetry={() => void users.refetch()}
          label={t('pick.loadFailed')}
          skeleton={<RowsSkeleton count={5} />}
        >
          {list.recent.length > 0 ? (
            <Section label={t('pick.recentSection')}>
              <Rows entries={list.recent} onPick={pick} />
            </Section>
          ) : null}

          {list.others.length > 0 ? (
            <Section label={list.recent.length > 0 ? t('pick.allSection') : undefined}>
              <Rows entries={list.others} onPick={pick} />
            </Section>
          ) : null}

          {total === 0 ? (
            <Gutter>
              <Text textStyle="caption" paddingBlock="8" textAlign="center">
                {searching ? t('pick.notFound', { query: query.trim() }) : t('pick.empty')}
              </Text>
            </Gutter>
          ) : null}
        </Loadable>
      </Body>
    </Screen>
  )
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <>
      {label ? (
        <Gutter paddingTop="3" paddingBottom="1">
          <Text textStyle="caption">{label}</Text>
        </Gutter>
      ) : null}
      {children}
    </>
  )
}

interface RowsProps {
  entries: RecipientEntry[]
  onPick: (user: RecipientEntry['user']) => void
}

/**
 * 겹치는 이름에 안내 문구를 붙였다가 뺐다. 사용자가 그 문장으로 하는 일이 없다 —
 * 나란히 놓인 두 줄과 강조된 핸들이 이미 "여기를 보라" 를 말한다.
 */
function Rows({ entries, onPick }: RowsProps) {
  return (
    <>
      {entries.map((entry) => (
        <RecipientRow key={entry.user.id} entry={entry} onPick={onPick} />
      ))}
    </>
  )
}

function RecipientRow({ entry, onPick }: { entry: RecipientEntry; onPick: RowsProps['onPick'] }) {
  const { t } = useTranslation()
  const { user, pulledUp } = entry

  return (
    <RowButton type="button" onClick={() => onPick(user)}>
      <Box
        aria-hidden
        flexShrink={0}
        boxSize="avatar"
        borderRadius="full"
        bg="bg.muted"
        color="fg.muted"
        display="grid"
        placeItems="center"
        textStyle="name"
      >
        {user.name.slice(0, 1)}
      </Box>

      <Box flex={1} minW={0}>
        <Box display="flex" alignItems="baseline" gap="2">
          <Text textStyle="name">{user.name}</Text>
          {pulledUp ? <Text textStyle="caption">{t('pick.notSentBefore')}</Text> : null}
        </Box>
        {/* 겹칠 때만 크기·굵기·색을 함께 올린다. 색만으로 구분하지 않는다. */}
        <Text
          textStyle={user.nameIsShared ? 'handleVerify' : 'handle'}
          color={user.nameIsShared ? 'verify.fg' : undefined}
        >
          {user.handle}
        </Text>
      </Box>
    </RowButton>
  )
}

import { Box, Input, Text } from '@chakra-ui/react'
import { useSetAtom } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackButton } from '@/shared/ui/BackButton'
import { IssuerSuffix } from '@/shared/ui/IssuerSuffix'
import { Loadable, RowSkeleton } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, Note, RowButton, Screen, SectionLabel, Title } from '@/shared/ui/Screen'
import { pickRecipientAtom } from '../model/atoms'
import type { Draft } from '../model/flow'
import type { RecipientEntry } from '../model/recipientList'
import { useRecipients } from '../model/useFlowPages'

/** 근거: docs/JOURNEY.md 여정 3 */
export function PickRecipient({ draft, onBack }: { draft: Draft; onBack: () => void }) {
  const { t } = useTranslation()
  const pick = useSetAtom(pickRecipientAtom)
  // 검색어는 서버 상태가 아니고 다른 화면이 알 필요도 없다.
  const [query, setQuery] = useState('')

  const searching = query.trim().length > 0
  const { list, total, pending, failed, retry } = useRecipients(draft.pointType.id, query)

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('pick.titleTransfer')}</Title>
        <Box display="flex" alignItems="baseline" gap="bond" flexWrap="wrap">
          <Text textStyle="caption" colorPalette={draft.pointType.accent} color="colorPalette.fg">
            {draft.pointType.name}
          </Text>
          <IssuerSuffix pointType={draft.pointType} />
        </Box>
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
          borderRadius="panel"
          bg="bg.panel"
        />
      </Gutter>

      <Body marginTop="tight">
        <Loadable
          pending={pending}
          failed={failed}
          onRetry={retry}
          label={t('pick.loadFailed')}
          skeleton={
            // 사람 줄에는 오른쪽 값이 없다. 넣으면 내용이 올 때 그 자리가 접힌다
            <>
              {[0, 1, 2, 3, 4].map((row) => (
                <RowSkeleton key={row} avatar />
              ))}
            </>
          }
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
            <Note>{searching ? t('pick.notFound', { query: query.trim() }) : t('pick.empty')}</Note>
          ) : null}
        </Loadable>
      </Body>
    </Screen>
  )
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
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
        <Box display="flex" alignItems="baseline" gap="tight">
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

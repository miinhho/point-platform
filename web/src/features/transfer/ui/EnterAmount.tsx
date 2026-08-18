import { Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import { BackButton } from '@/shared/ui/BackButton'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { Amount } from './Amount'
import { Keypad } from './Keypad'
import { draftAtom, editDraftAtom, toConfirmAtom } from '../model/atoms'
import { amountOf, appendDigit, clearAmount, isReady, removeDigit } from '../model/draft'

/** 근거: docs/JOURNEY.md 여정 4 */
export function EnterAmount({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const draft = useAtomValue(draftAtom)
  const edit = useSetAtom(editDraftAtom)
  const next = useSetAtom(toConfirmAtom)
  const wallet = useQuery(walletQuery())

  if (!draft?.to) return null

  const issuing = draft.kind === 'issue'
  // 서버가 실어 준 값을 표시할 뿐이다. 같은 규칙을 클라이언트가 다시 계산하지 않는다.
  const balance = wallet.data?.balances.find((b) => b.pointType.id === draft.pointType.id)
  const ceiling = issuing ? draft.pointType.issuableHeadroom : (balance?.sendable ?? 0)
  const amount = amountOf(draft)
  const over = amount > ceiling
  const ready = isReady(draft, ceiling)

  return (
    <Screen>
      {issuing ? <IssueBanner /> : null}
      <Header>
        <BackButton onClick={onBack} />
        <Title>
          {issuing ? draft.pointType.name : draft.to.name}
          {issuing ? null : (
            <Text as="span" textStyle="handle" marginInlineStart="2">
              {draft.to.handle}
            </Text>
          )}
        </Title>
      </Header>

      <Body>
        <Gutter paddingTop="6">
          <Amount pointType={draft.pointType} amount={amount} over={over} />
          <Text textStyle="support" color={over ? 'red.fg' : undefined} marginTop="5">
            {t(
              over
                ? issuing
                  ? 'amount.overIssue'
                  : 'amount.over'
                : issuing
                  ? 'amount.ceilingIssue'
                  : 'amount.ceiling',
              { amount: toGrouped(ceiling) },
            )}
          </Text>
        </Gutter>
      </Body>

      <Keypad
        onDigit={(d) => edit((draft) => appendDigit(draft, d))}
        onBackspace={() => edit(removeDigit)}
        onClear={() => edit(clearAmount)}
      />

      <Gutter paddingTop="2" paddingBottom="4">
        {/* 누를 수 없는 버튼을 감추지 않는다. 자리가 사라지면 다음에 뭘 할지 알 수 없다. */}
        <Button
          size="xl"
          width="full"
          disabled={!ready}
          onClick={() => next()}
          colorPalette={draft.pointType.accent}
        >
          {issuing ? t('amount.nextIssue') : t('amount.next')}
        </Button>
      </Gutter>
    </Screen>
  )
}

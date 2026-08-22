import { Button, Text } from '@chakra-ui/react'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { toGrouped } from '@/shared/format'
import { headroomOf } from '@/shared/headroom'
import { BackButton } from '@/shared/ui/BackButton'
import { IssuerSuffix } from '@/shared/ui/IssuerSuffix'
import { Body, Footer, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { Amount } from '../ui/Amount'
import { Keypad } from '../ui/Keypad'
import { editAmountAtom, toConfirmAtom } from '../model/atoms'
import { amountOf, appendDigit, clearAmount, isReady, removeDigit } from '../model/flow'
import type { AddressedDraft } from '../model/flow'

/**
 * 목적: 이 포인트를 얼마나 새로 만들지 정한다.
 *
 * 이체와 다른 화면인 이유는 주어가 다르기 때문이다 — 받는 사람이 없고, 상한도
 * 내 잔액이 아니라 발행 여력이다. 근거: docs/JOURNEY.md 여정 7
 */
export function EnterIssueAmount({
  draft,
  onBack,
}: {
  draft: AddressedDraft
  onBack: () => void
}) {
  const { t } = useTranslation()
  const edit = useSetAtom(editAmountAtom)
  const next = useSetAtom(toConfirmAtom)

  const ceiling = headroomOf(draft.pointType)
  const amount = amountOf(draft)
  const over = amount > ceiling

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{draft.pointType.name}</Title>
        <IssuerSuffix pointType={draft.pointType} />
      </Header>

      <Body>
        <Gutter paddingTop="block">
          <Amount pointType={draft.pointType} amount={amount} over={over} />
          <Text textStyle="support" color={over ? 'overLimit.fg' : undefined} marginTop="block">
            {t(over ? 'amount.overIssue' : 'amount.ceilingIssue', { amount: toGrouped(ceiling) })}
          </Text>
        </Gutter>
      </Body>

      <Keypad
        onDigit={(digit) => edit((current) => appendDigit(current, digit))}
        onBackspace={() => edit(removeDigit)}
        onClear={() => edit(clearAmount)}
      />

      <Footer>
        <Button
          size="xl"
          width="full"
          disabled={!isReady(draft, ceiling)}
          onClick={() => next()}
          colorPalette={draft.pointType.accent}
        >
          {t('amount.nextIssue')}
        </Button>
      </Footer>
    </Screen>
  )
}

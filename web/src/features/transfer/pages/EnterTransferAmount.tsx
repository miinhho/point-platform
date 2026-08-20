import { Button, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/shared/api'
import { toGrouped } from '@/shared/format'
import { BackButton } from '@/shared/ui/BackButton'
import { Body, Footer, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { Amount } from '../ui/Amount'
import { Keypad } from '../ui/Keypad'
import { editAmountAtom, toConfirmAtom } from '../model/atoms'
import { amountOf, appendDigit, clearAmount, isReady, removeDigit } from '../model/flow'
import type { AddressedDraft } from '../model/flow'

/**
 * 목적: 김지수에게 얼마를 보낼지 정한다.
 *
 * 주의가 처음 닿는 곳은 금액이고, 그 위 헤더가 누구에게인지를 붙들어 둔다.
 * 근거: docs/JOURNEY.md 여정 4
 */
export function EnterTransferAmount({
  draft,
  onBack,
}: {
  draft: AddressedDraft
  onBack: () => void
}) {
  const { t } = useTranslation()
  const edit = useSetAtom(editAmountAtom)
  const next = useSetAtom(toConfirmAtom)
  const wallet = useQuery(walletQuery())

  // 서버가 실어 준 값을 표시할 뿐이다. 같은 규칙을 클라이언트가 다시 계산하지 않는다.
  const balance = wallet.data?.balances.find((b) => b.pointType.id === draft.pointType.id)
  const ceiling = balance?.sendable ?? 0
  const amount = amountOf(draft)
  const over = amount > ceiling

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>
          {draft.to.name}
          <Text as="span" textStyle="handle" marginInlineStart="tight">
            {draft.to.handle}
          </Text>
        </Title>
      </Header>

      <Body>
        <Gutter paddingTop="block">
          <Amount pointType={draft.pointType} amount={amount} over={over} />
          <Text textStyle="support" color={over ? 'overLimit.fg' : undefined} marginTop="block">
            {t(over ? 'amount.over' : 'amount.ceiling', { amount: toGrouped(ceiling) })}
          </Text>
        </Gutter>
      </Body>

      <Keypad
        onDigit={(digit) => edit((current) => appendDigit(current, digit))}
        onBackspace={() => edit(removeDigit)}
        onClear={() => edit(clearAmount)}
      />

      <Footer>
        {/* 누를 수 없는 버튼을 감추지 않는다. 자리가 사라지면 다음에 뭘 할지 알 수 없다. */}
        <Button
          size="xl"
          width="full"
          disabled={!isReady(draft, ceiling)}
          onClick={() => next()}
          colorPalette={draft.pointType.accent}
        >
          {t('amount.next')}
        </Button>
      </Footer>
    </Screen>
  )
}

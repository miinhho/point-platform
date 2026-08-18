import { Text, chakra } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { toGrouped } from '@/domain/points'
import { BackButton } from '@/shared/ui/BackButton'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { Amount } from './Amount'
import { Keypad } from './Keypad'
import {
  backspaceAtom,
  clearAmountAtom,
  digitAtom,
  draftAtom,
  toConfirmAtom,
} from './atoms'
import { amountOf, isReady } from './draft'

const Next = chakra('button', {
  base: {
    width: '100%',
    minHeight: 'control',
    borderRadius: 'l2',
    textStyle: 'button',
    bg: 'colorPalette.solid',
    color: 'colorPalette.contrast',
    _active: { bg: 'colorPalette.emphasized' },
    // 누를 수 없는 버튼을 감추지 않는다. 자리가 사라지면 다음에 뭘 할지 알 수 없다.
    _disabled: { opacity: 0.35, cursor: 'default' },
  },
})

/** 근거: docs/JOURNEY.md 여정 4 */
export function EnterAmount({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const draft = useAtomValue(draftAtom)
  const digit = useSetAtom(digitAtom)
  const backspace = useSetAtom(backspaceAtom)
  const clear = useSetAtom(clearAmountAtom)
  const next = useSetAtom(toConfirmAtom)
  const wallet = useQuery(walletQuery())

  if (!draft?.to) return null

  const ceiling =
    wallet.data?.balances.find((b) => b.pointType.id === draft.pointType.id)?.amount ?? 0
  const amount = amountOf(draft)
  const over = amount > ceiling
  const ready = isReady(draft, ceiling)

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>
          {draft.to.name}
          <Text as="span" textStyle="handle" marginInlineStart="2">
            {draft.to.handle}
          </Text>
        </Title>
      </Header>

      <Body>
        <Gutter paddingTop="6">
          <Amount pointType={draft.pointType} amount={amount} over={over} />
          <Text textStyle="support" color={over ? 'red.fg' : undefined} marginTop="5">
            {over ? t('amount.over') : t('amount.ceiling')} {toGrouped(ceiling)}
          </Text>
        </Gutter>
      </Body>

      <Keypad onDigit={digit} onBackspace={backspace} onClear={clear} />

      <Gutter paddingTop="2" paddingBottom="4">
        <Next
          type="button"
          disabled={!ready}
          onClick={() => next()}
          colorPalette={draft.pointType.accent}
        >
          {t('amount.next')}
        </Next>
      </Gutter>
    </Screen>
  )
}

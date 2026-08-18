import { Box, Button, Field, Input, Text } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { queryKeys } from '@/api/queries'
import { ApiError, newIdempotencyKey } from '@/api/http'
import type { PointAccent, PointType } from '@/api/contract'
import { abbreviate, parseInput, toGrouped } from '@/shared/format'
import { failureTitleKey } from '@/shared/i18n/keys'
import { BackButton } from '@/shared/ui/BackButton'
import { HoldButton } from '@/shared/ui/HoldButton'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'

const ACCENTS: readonly PointAccent[] = ['blue', 'green', 'purple', 'orange', 'pink', 'teal']

interface Props {
  onBack: () => void
  onCreated: (pointType: PointType) => void
}

/** 근거: docs/JOURNEY.md 여정 9 */
export function CreatePoint({ onBack, onCreated }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [accent, setAccent] = useState<PointAccent>('blue')
  const [cap, setCap] = useState('')

  // 확정 직전에 만들지 않는다. 응답을 못 받고 다시 눌러도 같은 키여야 한다.
  const [idempotencyKey] = useState(newIdempotencyKey)

  const create = useMutation({
    mutationFn: () =>
      endpoints.createPointType(
        { name: name.trim(), symbol, accent, issueCap: parseInput(cap) },
        idempotencyKey,
      ),
    retry: false,
    onSuccess: (pointType) => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      onCreated(pointType)
    },
  })

  const capAmount = parseInput(cap)
  const ready = name.trim() !== '' && /^[A-Za-z]{2,3}$/.test(symbol) && capAmount > 0
  const error = create.error instanceof ApiError ? create.error : null

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('create.title')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="2" display="flex" flexDirection="column" gap="5">
          <Field.Root>
            <Field.Label>{t('create.name')}</Field.Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('create.namePlaceholder')}
              maxLength={12}
              size="lg"
            />
          </Field.Root>

          <Field.Root invalid={error?.code === 'SYMBOL_TAKEN'}>
            <Field.Label>{t('create.symbol')}</Field.Label>
            <Input
              value={symbol}
              // 기호는 대문자로만 보인다. 소문자로 쳐도 화면과 결과가 같아야 한다.
              onChange={(event) => setSymbol(event.target.value.toUpperCase().slice(0, 3))}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              size="lg"
            />
            {error?.code === 'SYMBOL_TAKEN' ? (
              <Field.ErrorText>{t(failureTitleKey(error.code))}</Field.ErrorText>
            ) : (
              <Field.HelperText>{t('create.symbolHint')}</Field.HelperText>
            )}
          </Field.Root>

          <AccentPicker value={accent} onChange={setAccent} />

          <Field.Root>
            <Field.Label>{t('create.cap')}</Field.Label>
            <Input
              value={cap === '' ? '' : toGrouped(capAmount)}
              onChange={(event) => setCap(event.target.value)}
              inputMode="numeric"
              size="lg"
            />
            {capAmount > 0 ? (
              <Field.HelperText>
                {t('create.capHint', { amount: abbreviate(capAmount) || toGrouped(capAmount) })}
              </Field.HelperText>
            ) : null}
          </Field.Root>

          <Preview name={name} symbol={symbol} accent={accent} />

          {error && error.code !== 'SYMBOL_TAKEN' ? (
            <Text role="alert" textStyle="support" color="red.fg">
              {t(failureTitleKey(error.code))}
            </Text>
          ) : null}
        </Gutter>
      </Body>

      <Gutter paddingTop="3" paddingBottom="4">
        <Text textStyle="caption" textAlign="center" marginBottom="2">
          {t('create.irreversible')}
        </Text>
        <Box colorPalette={accent}>
          <HoldButton
            label={t('create.hold')}
            onComplete={() => create.mutate()}
            disabled={!ready || create.isPending}
          />
        </Box>
      </Gutter>
    </Screen>
  )
}

/** 입력란만 보고는 결과를 알 수 없다 — 확정 전에 그 카드를 보여준다 */
function Preview({ name, symbol, accent }: { name: string; symbol: string; accent: PointAccent }) {
  const { t } = useTranslation()

  return (
    <Box>
      <Text textStyle="caption">{t('create.preview')}</Text>
      <Box
        marginTop="2"
        colorPalette={accent}
        display="flex"
        alignItems="center"
        gap="3"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l2"
        padding="3"
      >
        <PointBadge symbol={symbol} />
        <Text textStyle="name">{name}</Text>
      </Box>
    </Box>
  )
}

function AccentPicker({
  value,
  onChange,
}: {
  value: PointAccent
  onChange: (accent: PointAccent) => void
}) {
  const { t } = useTranslation()

  return (
    <Box role="radiogroup" aria-label={t('create.accent')}>
      <Text textStyle="label">{t('create.accent')}</Text>
      <Box marginTop="2" display="flex" gap="3">
        {ACCENTS.map((accent) => (
          <Button
            key={accent}
            role="radio"
            aria-checked={accent === value}
            aria-label={t(`create.accents.${accent}`)}
            colorPalette={accent}
            variant={accent === value ? 'solid' : 'outline'}
            size="lg"
            flex={1}
            minW={0}
            onClick={() => onChange(accent)}
          >
            {accent === value ? '✓' : ''}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

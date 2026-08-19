import { Box, Field, Input, RadioCard, Text } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { queryKeys } from '@/api/queries'
import { ApiError, newIdempotencyKey } from '@/api/http'
import type { PointAccent, PointType, PointVisibility } from '@/api/contract'
import { abbreviate, parseInput, toGrouped } from '@/shared/format'
import { failureTitleKey } from '@/shared/i18n/keys'
import { BackButton } from '@/shared/ui/BackButton'
import { HoldButton } from '@/shared/ui/HoldButton'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'

const ACCENTS: readonly PointAccent[] = [
  'blue',
  'green',
  'purple',
  'orange',
  'pink',
  'teal',
  'amber',
  'rose',
  'indigo',
  'lime',
]

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
  // 미리 골라 두지 않는다. 바꿀 수 없는 값의 기본값은 고른 적 없는 상태를 영구히 남긴다.
  const [visibility, setVisibility] = useState<PointVisibility | null>(null)
  const [cap, setCap] = useState('')

  // 확정 직전에 만들지 않는다. 응답을 못 받고 다시 눌러도 같은 키여야 한다.
  const [idempotencyKey] = useState(newIdempotencyKey)
  const symbolInput = useRef<HTMLInputElement>(null)

  const create = useMutation({
    mutationFn: (chosen: PointVisibility) =>
      endpoints.createPointType(
        { name: name.trim(), symbol, accent, issueCap: parseInput(cap), visibility: chosen },
        idempotencyKey,
      ),
    retry: false,
    onSuccess: (pointType) => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      onCreated(pointType)
    },
    // 어디를 고쳐야 하는지 포커스로도 말한다. 실패하면 포커스가 body 로 빠진다.
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === 'SYMBOL_TAKEN') {
        symbolInput.current?.focus()
      }
    },
  })

  const capAmount = parseInput(cap)
  const ready =
    name.trim() !== '' && /^[A-Za-z]{2,3}$/.test(symbol) && capAmount > 0 && visibility !== null
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
              ref={symbolInput}
              value={symbol}
              // 기호는 대문자로만 보인다. 소문자로 쳐도 화면과 결과가 같아야 한다.
              onChange={(event) => {
                setSymbol(event.target.value.toUpperCase().slice(0, 3))
                // 고친 기호에 낡은 겹침 판정이 붙어 있으면 화면이 거짓을 말한다.
                if (error?.code === 'SYMBOL_TAKEN') create.reset()
              }}
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

          <VisibilityPicker value={visibility} onChange={setVisibility} />

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
            onComplete={() => visibility && create.mutate(visibility)}
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

/**
 * 골라 둔 쪽이 없다. 「기본이 공개」면 비공개로 두려던 은행이 조용히 열린 채로 남고
 * 되돌릴 길이 없다 — 계약: docs/API.md
 */
function VisibilityPicker({
  value,
  onChange,
}: {
  value: PointVisibility | null
  onChange: (visibility: PointVisibility) => void
}) {
  const { t } = useTranslation()

  return (
    <RadioCard.Root
      value={value ?? undefined}
      onValueChange={({ value: next }) => next && onChange(next as PointVisibility)}
    >
      <RadioCard.Label textStyle="label">{t('create.visibility')}</RadioCard.Label>
      <Box marginTop="2" display="flex" gap="3">
        {(['public', 'private'] as const).map((option) => (
          <RadioCard.Item key={option} value={option} flex={1} minW={0}>
            <RadioCard.ItemHiddenInput />
            <RadioCard.ItemControl
              alignItems="start"
              paddingBlock="3"
              borderColor={option === value ? 'colorPalette.solid' : 'border'}
            >
              <RadioCard.ItemContent>
                <RadioCard.ItemText>
                  {t(option === 'public' ? 'create.visibilityPublic' : 'create.visibilityPrivate')}
                </RadioCard.ItemText>
                <RadioCard.ItemDescription>
                  {t(
                    option === 'public'
                      ? 'create.visibilityPublicNote'
                      : 'create.visibilityPrivateNote',
                  )}
                </RadioCard.ItemDescription>
              </RadioCard.ItemContent>
              <RadioCard.ItemIndicator />
            </RadioCard.ItemControl>
          </RadioCard.Item>
        ))}
      </Box>
      <Text textStyle="caption" marginTop="2">
        {t('create.visibilityFixed')}
      </Text>
    </RadioCard.Root>
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

  // 손으로 만들면 방향키 순회와 그룹당 탭 정지점 하나를 잃는다 — docs/FIELD.md S9-2
  return (
    <RadioCard.Root
      value={value}
      onValueChange={({ value: next }) => next && onChange(next as PointAccent)}
    >
      <RadioCard.Label textStyle="label">{t('create.accent')}</RadioCard.Label>
      {/*
        열 다 자기 색으로 칠해 둔다. 선택된 것만 칠하면 눌러 봐야 무슨 색인지 아는데,
        색을 고르는 자리에서 색이 안 보이는 것이다. 선택은 색이 아니라 테두리와 체크가
        말한다 — 선택 표시와 색 표시가 같은 채널을 쓰면 둘 다 못 한다.
      */}
      <Box marginTop="2" display="grid" gridTemplateColumns="repeat(5, 1fr)" gap="2">
        {ACCENTS.map((accent) => (
          <RadioCard.Item key={accent} value={accent} colorPalette={accent} minW={0}>
            <RadioCard.ItemHiddenInput />
            {/* 색 이름이 라디오의 접근성 이름이 된다. 색만으로 고르게 두지 않는다. */}
            <RadioCard.ItemText srOnly>{t(`create.accents.${accent}`)}</RadioCard.ItemText>
            <RadioCard.ItemControl
              justifyContent="center"
              paddingBlock="3"
              bg="colorPalette.solid"
              color="colorPalette.contrast"
              borderWidth={accent === value ? '3px' : '1px'}
              borderColor={accent === value ? 'fg' : 'border'}
            >
              {/* 회색조에서도 갈린다 — 두꺼운 테두리 + 체크 대 얇은 테두리 */}
              {accent === value ? '✓' : ''}
            </RadioCard.ItemControl>
          </RadioCard.Item>
        ))}
      </Box>
    </RadioCard.Root>
  )
}

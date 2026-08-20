import { Box, Field, Input, RadioCard, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { ALLOWED_EMOJI } from '@/shared/contract'
import type { PointAccent, PointVisibility } from '@/shared/contract'
import { abbreviate, toGrouped } from '@/shared/format'
import { failureTitleKey } from '@/shared/i18n/keys'
import { BackButton } from '@/shared/ui/BackButton'
import { HoldButton } from '@/shared/ui/HoldButton'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Body, Footer, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import { useCreatePoint } from '../model/useCreatePoint'
import { PointCreated } from './PointCreated'

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

/** 근거: docs/JOURNEY.md 여정 9 */
export function CreatePoint({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const form = useCreatePoint()
  const {
    name, setName, emoji, setEmoji, description, setDescription,
    accent, setAccent, visibility, setVisibility, cap, setCap,
    capAmount, ready, busy, error, submit, created,
  } = form

  // 결과는 장소가 아니라 방금 일어난 일이다. 주소를 주지 않는다
  if (created) return <PointCreated pointType={created} onHome={onBack} />

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('create.title')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="tight" display="flex" flexDirection="column" gap="block">
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

          <EmojiPicker value={emoji} onChange={setEmoji} />

          <AccentPicker value={accent} onChange={setAccent} />

          <Field.Root>
            <Field.Label>{t('create.description')}</Field.Label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('create.descriptionPlaceholder')}
              maxLength={60}
              size="lg"
            />
            {/* 없어도 만들어진다. 약속이 아니라 소개다 */}
            <Field.HelperText>{t('create.descriptionHint')}</Field.HelperText>
          </Field.Root>

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

          <Preview name={name} emoji={emoji} accent={accent} />

          {error ? (
            <Text role="alert" textStyle="support" color="failed.fg">
              {t(failureTitleKey(error.code))}
            </Text>
          ) : null}
        </Gutter>
      </Body>

      <Footer>
        <Text textStyle="caption" textAlign="center" marginBottom="tight">
          {t('create.irreversible')}
        </Text>
        <Box colorPalette={accent}>
          <HoldButton
            label={t('create.hold')}
            onComplete={submit}
            disabled={!ready || busy}
          />
        </Box>
      </Footer>
    </Screen>
  )
}

/** 입력란만 보고는 결과를 알 수 없다 — 확정 전에 그 카드를 보여준다 */
function Preview({
  name,
  emoji,
  accent,
}: {
  name: string
  emoji: string | null
  accent: PointAccent
}) {
  const { t } = useTranslation()

  return (
    <Box>
      <Text textStyle="caption">{t('create.preview')}</Text>
      <Box
        marginTop="tight"
        colorPalette={accent}
        display="flex"
        alignItems="center"
        gap="side"
        borderWidth="1px"
        borderColor="border"
        borderRadius="panel"
        padding="side"
      >
        <PointBadge emoji={emoji ?? ''} />
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
      <Box marginTop="tight" display="flex" gap="side">
        {(['public', 'private'] as const).map((option) => (
          <RadioCard.Item key={option} value={option} flex={1} minW={0}>
            <RadioCard.ItemHiddenInput />
            <RadioCard.ItemControl
              alignItems="start"
              paddingBlock="side"
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
      <Text textStyle="caption" marginTop="tight">
        {t('create.visibilityFixed')}
      </Text>
    </RadioCard.Root>
  )
}

/**
 * 자유 입력이 아니라 목록에서 고른다 — 이모지는 한 글자처럼 보여도 결합된 여러
 * 코드포인트일 수 있고 기기마다 다르게 보인다. 계약: docs/API.md
 */
function EmojiPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (emoji: string) => void
}) {
  const { t } = useTranslation()

  return (
    <RadioCard.Root
      value={value ?? undefined}
      onValueChange={({ value: next }) => next && onChange(next)}
    >
      <RadioCard.Label textStyle="label">{t('create.emoji')}</RadioCard.Label>
      <Box marginTop="tight" display="grid" gridTemplateColumns="repeat(6, 1fr)" gap="tight">
        {ALLOWED_EMOJI.map((option) => (
          <RadioCard.Item key={option} value={option} minW={0}>
            <RadioCard.ItemHiddenInput />
            <RadioCard.ItemText srOnly>{option}</RadioCard.ItemText>
            <RadioCard.ItemControl
              justifyContent="center"
              paddingBlock="tight"
              borderWidth={option === value ? '3px' : '1px'}
              borderColor={option === value ? 'fg' : 'border'}
            >
              {option}
            </RadioCard.ItemControl>
          </RadioCard.Item>
        ))}
      </Box>
      <Text textStyle="caption" marginTop="tight">
        {t('create.emojiHint')}
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
      <Box marginTop="tight" display="grid" gridTemplateColumns="repeat(5, 1fr)" gap="tight">
        {ACCENTS.map((accent) => (
          <RadioCard.Item key={accent} value={accent} colorPalette={accent} minW={0}>
            <RadioCard.ItemHiddenInput />
            {/* 색 이름이 라디오의 접근성 이름이 된다. 색만으로 고르게 두지 않는다. */}
            <RadioCard.ItemText srOnly>{t(`create.accents.${accent}`)}</RadioCard.ItemText>
            <RadioCard.ItemControl
              justifyContent="center"
              paddingBlock="side"
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

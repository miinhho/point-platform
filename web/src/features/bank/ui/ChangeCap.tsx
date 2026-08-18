import { Box, Field, Input, Text } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { queryKeys, walletQuery } from '@/api/queries'
import { ApiError, newIdempotencyKey } from '@/api/http'
import type { PointTypeId } from '@/api/contract'
import { abbreviate, parseInput, toGrouped } from '@/shared/format'
import { failureTitleKey } from '@/shared/i18n/keys'
import { BackButton } from '@/shared/ui/BackButton'
import { HoldButton } from '@/shared/ui/HoldButton'
import { Line } from '@/shared/ui/Line'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'

interface Props {
  pointTypeId: PointTypeId
  onBack: () => void
  onChanged: () => void
}

/** 근거: docs/JOURNEY.md 여정 9 — 발행과 같은 무게로 다룬다 */
export function ChangeCap({ pointTypeId, onBack, onChanged }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const wallet = useQuery(walletQuery())
  const [cap, setCap] = useState('')
  // 확정 직전에 만들지 않는다. 응답을 못 받고 다시 눌러도 이력에 두 줄이 생기면 안 된다.
  const [idempotencyKey] = useState(newIdempotencyKey)
  const capInput = useRef<HTMLInputElement>(null)

  const pointType = wallet.data?.balances.find((b) => b.pointType.id === pointTypeId)?.pointType

  const change = useMutation({
    mutationFn: (next: number) => endpoints.changeCap(pointTypeId, next, idempotencyKey),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      void client.invalidateQueries({ queryKey: queryKeys.history })
      onChanged()
    },
    // 어디를 고쳐야 하는지 포커스로도 말한다 — docs/FIELD.md S9-5 와 같은 자리다.
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === 'CAP_BELOW_ISSUED') {
        capInput.current?.focus()
      }
    },
  })

  if (!pointType) return null

  const next = parseInput(cap)
  // 같은 값은 이력에 아무것도 바꾸지 않는 줄을 만든다. 상한 판정 자체는 서버가 한다.
  const ready = next > 0 && next !== pointType.issueCap
  const error = change.error instanceof ApiError ? change.error : null

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('cap.title')}</Title>
        <Text textStyle="caption" colorPalette={pointType.accent} color="colorPalette.fg">
          {pointType.name}
        </Text>
      </Header>

      <Body>
        <Gutter paddingTop="4" display="flex" flexDirection="column" gap="5">
          <Box display="flex" flexDirection="column" gap="2">
            <Line label={t('bank.supply')} value={toGrouped(pointType.totalIssued)} />
            <Line label={t('cap.now')} value={toGrouped(pointType.issueCap)} />
          </Box>

          <Field.Root invalid={error?.code === 'CAP_BELOW_ISSUED'}>
            <Field.Label>{t('cap.next')}</Field.Label>
            <Input
              ref={capInput}
              value={cap === '' ? '' : toGrouped(next)}
              onChange={(event) => {
                setCap(event.target.value)
                // 고친 값에 낡은 판정이 붙어 있으면 화면이 거짓을 말한다.
                if (error?.code === 'CAP_BELOW_ISSUED') change.reset()
              }}
              inputMode="numeric"
              size="lg"
            />
            {error?.code === 'CAP_BELOW_ISSUED' ? (
              <Field.ErrorText>{t(failureTitleKey(error.code))}</Field.ErrorText>
            ) : (
              <Field.HelperText>
                {t('cap.floor', { amount: toGrouped(pointType.totalIssued) })}
              </Field.HelperText>
            )}
          </Field.Root>

          {/* 상한은 보유자에게 「여기까지만 희석된다」는 약속이다 — 무엇을 하는지 먼저 말한다 */}
          <Effect issueCap={pointType.issueCap} next={next} />

          {error && error.code !== 'CAP_BELOW_ISSUED' ? (
            <Text role="alert" textStyle="support" color="red.fg">
              {t(failureTitleKey(error.code))}
            </Text>
          ) : null}
        </Gutter>
      </Body>

      <Gutter paddingTop="3" paddingBottom="4">
        <Text textStyle="caption" textAlign="center" marginBottom="2">
          {t('cap.irreversible')}
        </Text>
        <Box colorPalette={pointType.accent}>
          <HoldButton
            label={t('cap.hold')}
            onComplete={() => change.mutate(next)}
            disabled={!ready || change.isPending}
          />
        </Box>
      </Gutter>
    </Screen>
  )
}

/** 바꾸기 전에 보유자에게 무엇을 하는 것인지 보여준다 */
function Effect({ issueCap, next }: { issueCap: number; next: number }) {
  const { t } = useTranslation()
  if (next <= 0 || next === issueCap) return null

  return (
    <Box padding="4" borderRadius="l2" bg="bg.panel">
      <Text textStyle="caption">{t('cap.holdersLabel')}</Text>
      <Text textStyle="body" marginTop="1">
        {t(next > issueCap ? 'cap.holdersRaised' : 'cap.holdersLowered', {
          amount: abbreviate(next) || toGrouped(next),
        })}
      </Text>
    </Box>
  )
}

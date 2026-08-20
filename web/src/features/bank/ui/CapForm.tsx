import { Box, Field, Input, Text, VisuallyHidden } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, newIdempotencyKey, pointsApi, queryKeys } from '@/shared/api'
import type { PointType } from '@/shared/contract'
import { abbreviate, parseInput, toGrouped } from '@/shared/format'
import { failureTitleKey } from '@/shared/i18n/keys'
import { HoldButton } from '@/shared/ui/HoldButton'

/**
 * 상한 변경. 발행과 같은 무게로 다룬다 — docs/JOURNEY.md 여정 9.
 * 지금 상한과 유통량은 이 페이지가 이미 말하므로 여기서 다시 말하지 않는다.
 */
export function CapForm({ pointType, onChanged }: { pointType: PointType; onChanged: () => void }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [cap, setCap] = useState('')
  // 확정 직전에 만들지 않는다. 응답을 못 받고 다시 눌러도 이력에 두 줄이 생기면 안 된다.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const capInput = useRef<HTMLInputElement>(null)
  const [changed, setChanged] = useState(false)

  const change = useMutation({
    mutationFn: (next: number) => pointsApi.changeCap(pointType.id, next, idempotencyKey),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.pointType(pointType.id) })
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
      void client.invalidateQueries({ queryKey: queryKeys.history })
      setCap('')
      setChanged(true)
      // 또 바꿀 수 있다. 키를 물려주면 두 번째가 첫 번째의 재시도가 된다.
      setIdempotencyKey(newIdempotencyKey())
      onChanged()
    },
    // 어디를 고쳐야 하는지 포커스로도 말한다 — docs/FIELD.md S9-5 와 같은 자리다.
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === 'CAP_BELOW_ISSUED') {
        capInput.current?.focus()
      }
    },
  })

  const next = parseInput(cap)
  // 같은 값은 이력에 아무것도 바꾸지 않는 줄을 만든다. 상한 판정 자체는 서버가 한다.
  const ready = next > 0 && next !== pointType.issueCap
  const error = change.error instanceof ApiError ? change.error : null

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Field.Root invalid={error?.code === 'CAP_BELOW_ISSUED'}>
        <Field.Label>{t('cap.next')}</Field.Label>
        <Input
          ref={capInput}
          value={cap === '' ? '' : toGrouped(next)}
          onChange={(event) => {
            setCap(event.target.value)
            setChanged(false)
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

      {/* 바뀐 값은 위의 표에 그대로 나온다. 화면을 못 보는 사람에게는 그것이 닿지 않는다 */}
      <VisuallyHidden aria-live="polite">{changed ? t('cap.changed') : ''}</VisuallyHidden>

      {/*
        고정하지 않는다. 붙여 두면 되돌릴 수 없는 조작이 엄지 자리에 상주한다 —
        그 자리는 그 화면의 주된 행동이 앉는 자리다. 밀림은 화면을 통째로 내주는
        것으로 푼다(`ChangeCap`). 근거: docs/MOTION.md
      */}
      <Box paddingTop="2">
        <Text textStyle="caption" textAlign="center" marginBottom="2">
          {t('cap.irreversible')}
        </Text>
        <HoldButton
          label={t('cap.hold')}
          onComplete={() => change.mutate(next)}
          disabled={!ready || change.isPending}
        />
      </Box>
    </Box>
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

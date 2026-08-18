import { Box, Button, Text } from '@chakra-ui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { failureTitleKey, failureWhereKey } from '@/shared/i18n/keys'
import { toGrouped } from '@/shared/format'
import { IssueBanner } from '@/shared/ui/IssueBanner'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import {
  draftAtom,
  editAmountAtom,
  endFlowAtom,
  failureAtom,
  repickAtom,
} from '../model/atoms'
import { handleFailure } from '../model/failure'
import { amountOf } from '../model/draft'

/** 근거: docs/JOURNEY.md 여정 6 — 가장 중요한 것은 돈이 어디 있는가다 */
export function Failure({ onCheck }: { onCheck: () => void }) {
  const { t } = useTranslation()
  const draft = useAtomValue(draftAtom)
  const failure = useAtomValue(failureAtom)
  const onEditAmount = useSetAtom(editAmountAtom)
  const onRepick = useSetAtom(repickAtom)
  const onHome = useSetAtom(endFlowAtom)

  if (!draft?.to || !failure) return null

  const handling = handleFailure(failure.code, draft.kind)

  return (
    <Screen>
      {draft.kind === 'issue' ? <IssueBanner /> : null}
      <Header>
        <Title>{t('failure.heading')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="4">
          <Text role="status" aria-live="assertive" textStyle="headline">
            {t(failureTitleKey(failure.code))}
          </Text>

          {/* 이 화면에서 가장 중요한 한 줄이다. 결과를 모를 때는 단정하지 않는다. */}
          <Box
            marginTop="4"
            padding="4"
            borderRadius="l2"
            borderWidth="1px"
            bg={handling.outcomeUnknown ? 'pending.subtle' : 'bg.panel'}
            borderColor={handling.outcomeUnknown ? 'pending.fg' : 'border'}
          >
            <Text textStyle="caption">
              {handling.outcomeUnknown ? t('failure.unknownLabel') : t('failure.whereLabel')}
            </Text>
            <Text textStyle="body" marginTop="1">
              {t(failureWhereKey(failure.code, draft.kind))}
            </Text>
          </Box>

          {/* 입력을 버리지 않았다는 것을 보여준다. */}
          <Box marginTop="4" padding="4" borderRadius="l2" bg="bg.panel">
            <Text textStyle="caption">{t('failure.draftLabel')}</Text>
            <Box display="flex" alignItems="baseline" gap="2" marginTop="1">
              <Text textStyle="name">{draft.to.name}</Text>
              <Text textStyle="handle">{draft.to.handle}</Text>
            </Box>
            <Text textStyle="caption" marginTop="2">
              {draft.pointType.name}
            </Text>
            <Text textStyle="balance">{toGrouped(amountOf(draft))}</Text>
          </Box>
        </Gutter>
      </Body>

      <Gutter paddingBottom="4">
        <Box colorPalette={draft.pointType.accent} display="flex" flexDirection="column" gap="2">
          {handling.retryable ? (
            <Button size="xl" width="full" onClick={onCheck}>
              {t('failure.check')}
            </Button>
          ) : null}
          {handling.editable ? (
            <Button
              size="xl"
              width="full"
              variant={handling.retryable ? 'outline' : 'solid'}
              onClick={onEditAmount}
            >
              {t('failure.editAmount')}
            </Button>
          ) : null}
          {handling.repickable ? (
            <Button size="xl" width="full" onClick={onRepick}>
              {t('failure.repick')}
            </Button>
          ) : null}
          <Button size="xl" width="full" variant="outline" onClick={onHome}>
            {t('failure.home')}
          </Button>
        </Box>
      </Gutter>
    </Screen>
  )
}

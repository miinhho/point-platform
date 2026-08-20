import { Box, Button, Text } from '@chakra-ui/react'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { failureTitleKey, failureWhereKey } from '@/shared/i18n/keys'
import { toGrouped } from '@/shared/format'
import { IssuerSuffix } from '@/shared/ui/IssuerSuffix'
import { Body, Footer, Gutter, Header, Panel, Screen, Title } from '@/shared/ui/Screen'
import { backToAmountAtom, repickAtom } from '../model/atoms'
import { handleFailure } from '../model/failure'
import { amountOf, type SealedDraft } from '../model/flow'
import type { Failure as FailureValue } from '@/shared/contract'

interface Props {
  draft: SealedDraft
  failure: FailureValue
  onCheck: () => void
  /** 흐름을 접고 홈으로 */
  onDone: () => void
}

/** 근거: docs/JOURNEY.md 여정 6 — 가장 중요한 것은 돈이 어디 있는가다 */
export function Failure({ draft, failure, onCheck, onDone }: Props) {
  const { t } = useTranslation()
  const onEditAmount = useSetAtom(backToAmountAtom)
  const onRepick = useSetAtom(repickAtom)

  const handling = handleFailure(failure.code, draft.kind)
  const unknown = failure.outcome === 'unknown'
  const issuing = draft.kind === 'issue'

  return (
    <Screen>
      <Header>
        <Title>{t(issuing ? 'failure.headingIssue' : 'failure.heading')}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="inset">
          <Text role="status" aria-live="assertive" textStyle="headline">
            {t(failureTitleKey(failure.code))}
          </Text>

          {/* 이 화면에서 가장 중요한 한 줄이다. 결과를 모를 때는 단정하지 않는다. */}
          <Panel marginTop="inset" raised={!unknown} pending={unknown}>
            <Text textStyle="caption">
              {unknown ? t('failure.unknownLabel') : t('failure.whereLabel')}
            </Text>
            <Text textStyle="body" marginTop="bond">
              {t(failureWhereKey(failure.code, draft.kind))}
            </Text>
          </Panel>

          {/* 입력을 버리지 않았다는 것을 보여준다. */}
          <Panel marginTop="inset">
            <Text textStyle="caption">
              {t(issuing ? 'failure.draftLabelIssue' : 'failure.draftLabel')}
            </Text>
            {issuing ? null : (
              <Box display="flex" alignItems="baseline" gap="tight" marginTop="bond">
                <Text textStyle="name">{draft.to.name}</Text>
                <Text textStyle="handle">{draft.to.handle}</Text>
              </Box>
            )}
            <Box display="flex" alignItems="baseline" gap="bond" marginTop="tight" flexWrap="wrap">
              <Text textStyle="caption">{draft.pointType.name}</Text>
              <IssuerSuffix pointType={draft.pointType} />
            </Box>
            <Text textStyle="balance">{toGrouped(amountOf(draft))}</Text>
          </Panel>
        </Gutter>
      </Body>

      <Footer>
        <Box colorPalette={draft.pointType.accent} display="flex" flexDirection="column" gap="tight">
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
          <Button size="xl" width="full" variant="outline" onClick={onDone}>
            {t('failure.home')}
          </Button>
        </Box>
      </Footer>
    </Screen>
  )
}

import { Box, Button, Text } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError, membersQuery, pointTypeQuery, pointsApi, queryKeys } from '@/shared/api'
import type { PointType, PointTypeId, User, UserId } from '@/shared/contract'
import { failureTitleKey } from '@/shared/i18n/keys'
import { BackButton } from '@/shared/ui/BackButton'
import { Loadable, RowSkeleton } from '@/shared/ui/Loadable'
import { Body, Gutter, Header, Row, Screen, Title } from '@/shared/ui/Screen'

interface Props {
  pointTypeId: PointTypeId
  onBack: () => void
  /** 나가도 은행 페이지는 계속 보인다. 그 페이지가 왜 못 쓰는지 말하는 자리다 */
  onLeft: () => void
}

/**
 * 회원 목록. 나가기와 내보내기가 같은 자리에 있다 — 둘은 같은 일을 하고 누가
 * 정했느냐만 다르다. 근거: docs/API.md 「회원 자격」
 */
export function Members({ pointTypeId, onBack, onLeft }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { data: pointType } = useQuery(pointTypeQuery(pointTypeId))
  const list = useQuery(membersQuery(pointTypeId))
  const members = list.data

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.members(pointTypeId) })
    void client.invalidateQueries({ queryKey: queryKeys.pointType(pointTypeId) })
    void client.invalidateQueries({ queryKey: queryKeys.wallet })
  }

  const remove = useMutation({
    mutationFn: (userId: UserId) => pointsApi.removeMember(pointTypeId, userId),
    retry: false,
    onSuccess: invalidate,
  })

  const leave = useMutation({
    mutationFn: () => pointsApi.leaveBank(pointTypeId),
    retry: false,
    onSuccess: () => {
      invalidate()
      onLeft()
    },
  })

  if (!pointType) return null

  const error = [remove.error, leave.error].find(
    (candidate): candidate is ApiError => candidate instanceof ApiError,
  )

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{t('bank.members')}</Title>
        <Text textStyle="caption" colorPalette={pointType.accent} color="colorPalette.fg">
          {pointType.name}
        </Text>
      </Header>

      <Body>
        <Loadable
          pending={list.isPending}
          failed={list.isError}
          onRetry={() => void list.refetch()}
          label={t('bank.membersFailed')}
          skeleton={
            <>
              {[0, 1, 2].map((row) => (
                <RowSkeleton key={row} trailing="64px" />
              ))}
            </>
          }
        >
          {members?.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              pointType={pointType}
              onRemove={pointType.canIssue ? () => remove.mutate(member.id) : undefined}
              busy={remove.isPending}
            />
          ))}
        </Loadable>

        {error ? (
          <Gutter paddingTop="3">
            <Text role="alert" textStyle="support" color="red.fg">
              {t(failureTitleKey(error.code))}
            </Text>
          </Gutter>
        ) : null}
      </Body>

      {/* 은행장은 나갈 수 없다. 누를 수 없는 버튼이 아니라 버튼이 없어야 한다 */}
      {pointType.canIssue ? null : (
        <Gutter paddingTop="3" paddingBottom="4">
          <Text textStyle="caption" textAlign="center" marginBottom="2">
            {t('bank.leaveKeeps')}
          </Text>
          <Button
            size="lg"
            width="full"
            variant="outline"
            disabled={leave.isPending}
            onClick={() => leave.mutate()}
          >
            {t('bank.leave')}
          </Button>
        </Gutter>
      )}
    </Screen>
  )
}

interface MemberRowProps {
  member: User
  pointType: PointType
  onRemove?: () => void
  busy: boolean
}

function MemberRow({ member, pointType, onRemove, busy }: MemberRowProps) {
  const { t } = useTranslation()
  const isIssuer = member.id === pointType.issuerId

  return (
    <Row>
      <Box flex={1} minW={0}>
        <Box display="flex" alignItems="baseline" gap="2">
          <Text textStyle="name">{member.name}</Text>
          {isIssuer ? <Text textStyle="caption">{t('bank.issuerBadge')}</Text> : null}
        </Box>
        <Text
          textStyle={member.nameIsShared ? 'handleVerify' : 'handle'}
          color={member.nameIsShared ? 'verify.fg' : undefined}
        >
          {member.handle}
        </Text>
      </Box>

      {/* 은행장은 내보내질 수 없다 — 발행할 사람이 없는 은행이 된다 */}
      {onRemove && !isIssuer ? (
        <Button size="xs" variant="outline" flexShrink={0} disabled={busy} onClick={onRemove}>
          {t('bank.remove')}
        </Button>
      ) : null}
    </Row>
  )
}

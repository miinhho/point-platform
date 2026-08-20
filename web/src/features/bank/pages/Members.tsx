import { Box, Button, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { PointType, PointTypeId, User } from '@/shared/contract'
import { failureTitleKey } from '@/shared/i18n/keys'
import { BackButton } from '@/shared/ui/BackButton'
import { Loadable, RowSkeleton } from '@/shared/ui/Loadable'
import { Body, Footer, Gutter, Header, Row, Screen, Title } from '@/shared/ui/Screen'
import { useMembersPage } from '../model/useMembersPage'

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
  const { pointType, members, error, busy, remove, leave, pending, failed, retry } =
    useMembersPage(pointTypeId, onLeft)

  // 은행 조회는 이 화면에 오기 전에 이미 캐시에 있다. 없으면 잠깐 비었다가 찬다.
  if (!pointType) return null

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
          pending={pending}
          failed={failed}
          onRetry={retry}
          label={t('bank.membersFailed')}
          skeleton={
            <>
              {[0, 1, 2].map((row) => (
                <RowSkeleton key={row} trailing="64px" />
              ))}
            </>
          }
        >
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              pointType={pointType}
              onRemove={pointType.canIssue ? () => remove(member.id) : undefined}
              busy={busy}
            />
          ))}
        </Loadable>

        {error ? (
          <Gutter paddingTop="side">
            <Text role="alert" textStyle="support" color="failed.fg">
              {t(failureTitleKey(error.code))}
            </Text>
          </Gutter>
        ) : null}
      </Body>

      {/* 은행장은 나갈 수 없다. 누를 수 없는 버튼이 아니라 버튼이 없어야 한다 */}
      {pointType.canIssue ? null : (
        <Footer>
          <Text textStyle="caption" textAlign="center">
            {t('bank.leaveKeeps')}
          </Text>
          <Button
            size="lg"
            width="full"
            variant="outline"
            disabled={busy}
            onClick={leave}
          >
            {t('bank.leave')}
          </Button>
        </Footer>
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
        <Box display="flex" alignItems="baseline" gap="tight">
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

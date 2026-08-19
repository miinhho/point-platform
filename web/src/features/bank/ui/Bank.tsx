import { Box, Button, Text, VisuallyHidden } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { endpoints } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { invitesQuery, membersQuery, pointTypeQuery, queryKeys, walletQuery } from '@/api/queries'
import { goAtom } from '@/app/atoms'
import { toGrouped } from '@/shared/format'
import { startIssueAtom, startTransferAtom } from '@/features/transfer'
import { BackButton } from '@/shared/ui/BackButton'
import { IssuerSuffix } from '@/shared/ui/IssuerSuffix'
import { Line } from '@/shared/ui/Line'
import { PointBadge } from '@/shared/ui/PointBadge'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import type { PointType, PointTypeId } from '@/api/contract'
import { formatCreated } from '../model/created'
import { CapForm } from './CapForm'

/**
 * 포인트 하나에 페이지 하나다. 보는 사람에 따라 내용이 늘어날 뿐 다른 페이지가
 * 되지 않는다 — docs/JOURNEY.md 「은행 페이지」
 */
export function Bank({ pointTypeId, onBack }: { pointTypeId: PointTypeId; onBack: () => void }) {
  const { t } = useTranslation()
  const { data: pointType } = useQuery(pointTypeQuery(pointTypeId))
  const wallet = useQuery(walletQuery())
  const startTransfer = useSetAtom(startTransferAtom)
  const startIssue = useSetAtom(startIssueAtom)
  const go = useSetAtom(goAtom)
  // 수락하면 초대가 사라진다. 그래서 「초대가 있다」가 곧 「아직 회원이 아니다」다.
  const invites = useQuery(invitesQuery())
  const invite = invites.data?.find((candidate) => candidate.pointType.id === pointTypeId)
  const isPrivate = pointType?.visibility === 'private'
  /*
   * 회원인가. 회원 목록이 회원에게만 열린다는 것이 서버의 판정이라 그것을 읽는다 —
   * `sendable === 0` 에서 되짚으면 보류금과 구별되지 않고, 그건 규칙을 화면이 다시
   * 계산하는 것이다. 계약: docs/API.md 「회원 자격」
   */
  const members = useQuery({
    ...membersQuery(pointTypeId),
    enabled: isPrivate && !invite,
    retry: false,
  })
  /*
   * 회원 명부가 셋으로 답한다 — 계약: docs/API.md. 「회원이 아니다」는 서버가
   * `NOT_MEMBER` 로 말했을 때만이다. 아무 오류나 그렇게 읽으면 경로가 없거나
   * 서버가 넘어졌을 때 회원에게 「회원이 아니에요」라고 말한다 (docs/FIELD.md W7).
   */
  const outside =
    isPrivate && !invite && members.error instanceof ApiError && members.error.code === 'NOT_MEMBER'

  const balance = wallet.data?.balances.find((b) => b.pointType.id === pointTypeId)

  if (!pointType) return null

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <Title>{pointType.name}</Title>
      </Header>

      <Body>
        <Gutter paddingTop="4" paddingBottom="6" colorPalette={pointType.accent}>
          <Intro pointType={pointType} />

          {invite ? <Join inviteId={invite.id} pointTypeId={pointTypeId} /> : null}

          {/* 회원 목록은 회원만 본다. 초대받았을 뿐이거나 나온 사람은 명부를 볼 자리가 아니다 */}
          {isPrivate && !invite && !outside ? (
            <Box marginTop="6">
              <Button
                size="lg"
                width="full"
                variant="outline"
                onClick={() => go({ name: 'members', pointTypeId: pointType.id })}
              >
                {t('bank.membersEntry')}
              </Button>
            </Box>
          ) : null}

          {balance ? (
            <Box marginTop="6" display="flex" flexDirection="column" gap="3">
              <Line
                label={t('bank.myBalance')}
                value={toGrouped(balance.amount)}
                textStyle="lineStrong"
              />
              {outside ? (
                <Outside />
              ) : (
                <Button
                  size="xl"
                  width="full"
                  disabled={balance.sendable === 0}
                  onClick={() => startTransfer({ pointType })}
                >
                  {t('bank.send')}
                </Button>
              )}
            </Box>
          ) : null}

          {pointType.canIssue ? (
            <Box marginTop="8" display="flex" flexDirection="column" gap="3">
              <Line
                label={t('bank.headroom')}
                value={toGrouped(pointType.issuableHeadroom)}
                textStyle="lineStrong"
              />
              <Button
                size="xl"
                width="full"
                onClick={() => wallet.data && startIssue({ pointType, me: wallet.data.user })}
              >
                {t('bank.issue')}
              </Button>
              {pointType.visibility === 'private' ? (
                <Button
                  size="lg"
                  width="full"
                  variant="outline"
                  onClick={() => go({ name: 'invite', pointTypeId: pointType.id })}
                >
                  {t('bank.invite')}
                </Button>
              ) : null}
              {/* 상한도 발행과 같은 무게다. 그래서 같은 자리에 둔다 — 여정 9 */}
              <Box marginTop="4">
                <CapForm pointType={pointType} />
              </Box>
            </Box>
          ) : null}
        </Gutter>
      </Body>
    </Screen>
  )
}

/**
 * 나온 사람에게 이 페이지는 물으러 갈 곳이다 — 왜 못 쓰는지가 여기 없으면 갈 데가
 * 없다. 겁주는 자리가 아니라 사실을 적는 자리다. 근거: docs/API.md 「회원 자격」
 */
function Outside() {
  const { t } = useTranslation()

  return (
    <Box padding="4" borderRadius="l2" bg="bg.panel">
      <Text textStyle="support">{t('bank.outsider')}</Text>
      <Text textStyle="caption" marginTop="1">
        {t('bank.outsiderWhy')}
      </Text>
      <Text textStyle="caption" marginTop="2">
        {t('bank.outsiderKeeps')}
      </Text>
    </Box>
  )
}

/**
 * 가입은 되돌릴 수 있다 — 나가면 된다. 되돌릴 수 없는 것은 그 안에서 주고받은
 * 것이지 소속이 아니다. 그래서 꾹 누르게 만들지 않는다 — docs/JOURNEY.md 여정 10
 */
function Join({ inviteId, pointTypeId }: { inviteId: string; pointTypeId: PointTypeId }) {
  const { t } = useTranslation()
  const client = useQueryClient()

  const join = useMutation({
    mutationFn: () => endpoints.acceptInvite(inviteId),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.invites })
      void client.invalidateQueries({ queryKey: queryKeys.pointType(pointTypeId) })
      void client.invalidateQueries({ queryKey: queryKeys.wallet })
    },
  })

  return (
    <Box marginTop="6">
      <VisuallyHidden aria-live="polite">{join.isSuccess ? t('bank.joined') : ''}</VisuallyHidden>
      <Button
        size="xl"
        width="full"
        disabled={join.isPending}
        onClick={() => join.mutate()}
      >
        {t('bank.join')}
      </Button>
    </Box>
  )
}

/**
 * 흉내낼 수 없는 것만 판단의 근거가 된다 — 이름·기호·색은 전부 고르는 것이고
 * 핸들은 하나뿐이다. 근거: docs/JOURNEY.md 여정 10
 */
function Intro({ pointType }: { pointType: PointType }) {
  const { t } = useTranslation()

  return (
    <>
      <Box display="flex" alignItems="center" gap="3">
        <PointBadge symbol={pointType.symbol} />
        <Box flex={1} minW={0}>
          <Text textStyle="name">{pointType.name}</Text>
          <IssuerSuffix pointType={pointType} />
        </Box>
      </Box>

      <Box marginTop="5" display="flex" flexDirection="column" gap="2">
        <Line label={t('bank.issuer')} value={pointType.issuerHandle} textStyle="mono" />
        <Line label={t('bank.created')} value={formatCreated(pointType.createdAt)} />
        <Line label={t('bank.supply')} value={toGrouped(pointType.totalIssued)} />
        {/* 상한은 발행자의 설정이 아니라 보유자에게 하는 약속이다 — 계약: docs/API.md */}
        <Line label={t('bank.cap')} value={toGrouped(pointType.issueCap)} />
        {/* 공개 은행에는 회원 개념이 없어 `null` 이다. 0 명과 구별된다 */}
        {pointType.memberCount === null ? null : (
          <Line
            label={t('bank.members')}
            value={t('bank.memberCountValue', { count: pointType.memberCount })}
          />
        )}
      </Box>
    </>
  )
}

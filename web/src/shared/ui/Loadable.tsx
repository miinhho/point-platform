import { Box, Button, Skeleton, SkeletonCircle, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { Gutter, Row } from './Screen'

interface Props {
  /** 조회가 아직 답하지 않았는가 */
  pending: boolean
  /** 조회가 실패했는가. 빈 결과와 절대 같은 화면이 되면 안 된다 */
  failed: boolean
  onRetry: () => void
  /** 무엇을 못 불러왔는가. 「불러오지 못했어요」만으로는 어디를 다시 볼지 알 수 없다 */
  label: string
  /** 올 내용의 모양. 스피너 하나를 두면 내용이 뜨는 순간 화면이 통째로 뛴다 */
  skeleton: ReactNode
  children: ReactNode
}

/**
 * 조회의 세 상태를 한 곳에서 그린다.
 *
 * 화면마다 만들면 곧 여덟 곳만 있는 상태가 된다. 그리고 이 앱은 「가진 적 없는 0」과
 * 「가졌던 0」을 가르려고 애쓰는데, 「못 불러온 것」이 그 둘과 같아 보이면 그 노력이
 * 통째로 무너진다. 근거: CLAUDE.md · docs/JOURNEY.md 여정 1
 */
export function Loadable({ pending, failed, onRetry, label, skeleton, children }: Props) {
  const { t } = useTranslation()

  if (failed) {
    return (
      <Gutter paddingTop="part">
        <Box role="alert" display="flex" flexDirection="column" gap="bond" alignItems="center">
          <Text textStyle="support">{label}</Text>
          {/* 조회는 돈을 움직이지 않는다. 실패 문구는 그것을 늘 말한다 */}
          <Text textStyle="caption">{t('common.loadFailedWhere')}</Text>
        </Box>
        <Button size="lg" width="full" variant="outline" marginTop="block" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </Gutter>
    )
  }

  return <>{pending ? skeleton : children}</>
}

/*
 * 아래는 **조각**이다. 조합은 화면이 한다.
 *
 * 균일한 회색 줄을 늘어놓는 뼈대는 어느 화면에나 쓸 수 있고 그래서 어느 화면에도
 * 맞지 않는다 — 스피너를 회색 사각형으로 바꾼 것에 지나지 않는다. 뼈대의 유일한
 * 임무는 올 것의 자리를 잡는 것이고, 제일 큰 요소부터 잡아야 화면이 덜 뛴다.
 */

/** 목록 한 줄. 아바타·부제·오른쪽 값은 그 목록에 실제로 있는 것만 켠다 */
export function RowSkeleton({
  avatar = false,
  caption = true,
  trailing,
}: {
  avatar?: boolean
  caption?: boolean
  trailing?: string
}) {
  return (
    <Row aria-hidden>
      {avatar ? <SkeletonCircle boxSize="avatar" flexShrink={0} /> : null}
      <Box flex={1} minW={0} display="flex" flexDirection="column" gap="tight">
        <Skeleton height="4" width="40%" />
        {caption ? <Skeleton height="3" width="24%" /> : null}
      </Box>
      {trailing ? <Skeleton height="5" width={trailing} flexShrink={0} /> : null}
    </Row>
  )
}

/** 라벨과 값 한 줄 */
export function LineSkeleton() {
  return (
    <Box aria-hidden display="flex" justifyContent="space-between" gap="inset">
      <Skeleton height="3" width="20%" />
      <Skeleton height="3" width="32%" />
    </Box>
  )
}

/** 잔액·발행량이 앉는 제일 큰 자리. 여기를 안 잡으면 다른 것을 다 잡아도 뛴다 */
export function AmountSkeleton() {
  return <Skeleton aria-hidden height="9" width="56%" />
}

/** 이름이 앉는 자리 */
export function NameSkeleton({ width = '44%' }: { width?: string }) {
  return <Skeleton aria-hidden height="6" width={width} />
}

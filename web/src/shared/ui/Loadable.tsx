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
      <Gutter paddingTop="8">
        <Box role="alert" display="flex" flexDirection="column" gap="1" alignItems="center">
          <Text textStyle="support">{label}</Text>
          {/* 조회는 돈을 움직이지 않는다. 실패 문구는 그것을 늘 말한다 */}
          <Text textStyle="caption">{t('common.loadFailedWhere')}</Text>
        </Box>
        <Button size="lg" width="full" variant="outline" marginTop="5" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </Gutter>
    )
  }

  return <>{pending ? skeleton : children}</>
}

/** 목록이 올 자리. 줄 수는 화면이 정한다 — 실제로 올 만큼이어야 자리가 안 뛴다 */
export function RowsSkeleton({ count = 3, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <Box aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Row key={index}>
          {avatar ? <SkeletonCircle boxSize="avatar" flexShrink={0} /> : null}
          <Box flex={1} minW={0} display="flex" flexDirection="column" gap="2">
            <Skeleton height="4" width="40%" />
            <Skeleton height="3" width="24%" />
          </Box>
          <Skeleton height="5" width="72px" flexShrink={0} />
        </Row>
      ))}
    </Box>
  )
}

/** 라벨과 값이 줄줄이 오는 자리 — 소개·상세가 같은 모양이다 */
export function LinesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Box aria-hidden display="flex" flexDirection="column" gap="3">
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} display="flex" justifyContent="space-between" gap="4">
          <Skeleton height="3" width="20%" />
          <Skeleton height="3" width="32%" />
        </Box>
      ))}
    </Box>
  )
}

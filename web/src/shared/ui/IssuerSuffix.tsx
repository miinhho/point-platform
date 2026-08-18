import { Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { PointType } from '@/api/contract'

/**
 * 이름이 겹칠 때만 붙는 발행자 부제 — docs/JOURNEY.md 여정 1·2.
 * 겹치는지는 서버가 답한다. 항상 붙이면 배경이 되어 정작 겹칠 때 눈에 띄지 않는다.
 */
export function IssuerSuffix({ pointType }: { pointType: PointType }) {
  const { t } = useTranslation()
  if (!pointType.nameIsShared) return null

  return <Text textStyle="caption">{t('common.issuedBy', { name: pointType.issuerName })}</Text>
}

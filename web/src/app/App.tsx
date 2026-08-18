import { Box, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

/**
 * 재구축 중 (`docs/REBUILD.md`).
 *
 * 화면은 T6 부터 여정 단위로 다시 만든다. 그전까지 이 자리를 비워 둬야 타입 검사와
 * 테스트가 계속 돈다. 문자열은 이미 카탈로그를 거친다 — 자리표시자에서라도
 * 하드코딩을 시작하면 T6 에서 그것을 찾아다니게 된다.
 */
export default function App() {
  const { t } = useTranslation()

  return (
    <Box height="100%" display="grid" placeItems="center" bg="bg" padding="8">
      <Text fontSize="sm" color="fg.muted" textAlign="center">
        {t('common.loading')}
      </Text>
    </Box>
  )
}

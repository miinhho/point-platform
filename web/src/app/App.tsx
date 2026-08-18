import { Box, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

/** 자리표시자. 화면은 슬라이스별로 만든다 — docs/REBUILD.md */
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

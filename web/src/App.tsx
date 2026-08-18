import { Box, Text } from '@chakra-ui/react'

/**
 * 재구축 중 (`docs/REBUILD.md`).
 *
 * 화면은 T6 부터 여정 단위로 다시 만든다. 그전까지 T1~T5 는 도메인·구조·상태·문자열·
 * 디자인 토큰을 세우는 단계라서, 이 자리를 비워 둬야 타입 검사와 테스트가 계속 돈다.
 */
export default function App() {
  return (
    <Box height="100%" display="grid" placeItems="center" bg="bg" padding="8">
      <Text fontSize="sm" color="fg.muted" textAlign="center">
        재구축 중입니다. 화면은 T6 부터 다시 만듭니다.
      </Text>
    </Box>
  )
}

import { Box, Text } from '@chakra-ui/react'

interface Props {
  label: string
  value: string
  /** 값의 표기. 표에서 가장 중요한 값은 `lineStrong`, 사람이 대조하는 문자열은 `mono` */
  textStyle?: 'line' | 'lineStrong' | 'mono'
  /** 항목이 많아 눈이 줄을 잃는 표에서만 */
  divided?: boolean
}

/** 라벨과 값 한 줄. 확정·발행 관리·내역 상세가 같은 표를 그린다 */
export function Line({ label, value, textStyle = 'line', divided }: Props) {
  return (
    <Box
      display="flex"
      alignItems="baseline"
      justifyContent="space-between"
      gap="4"
      paddingBlock={divided ? '2.5' : undefined}
      borderBottomWidth={divided ? '1px' : undefined}
      borderColor={divided ? 'border' : undefined}
    >
      <Text textStyle="caption" flexShrink={0}>
        {label}
      </Text>
      <Text textStyle={textStyle} textAlign="end">
        {value}
      </Text>
    </Box>
  )
}

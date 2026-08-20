import { chakra } from '@chakra-ui/react'

/** 확정 화면이 보여 주는 것을 한 덩어리로 묶는다. 이체와 발행이 같은 상자를 쓴다 */
export const Card = chakra('div', {
  base: {
    bg: 'bg.panel',
    borderRadius: 'l3',
    borderWidth: '1px',
    borderColor: 'border',
    padding: '5',
  },
})

import { Box, Text } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'
import { Amount } from '@/ui/Amount'
import { MotionButton, useTapScale } from '@/ui/motion'
import { Body, Card, Footer, Gutter, Screen } from '@/ui/Screen'
import { label, UNIT_SYMBOL } from '@/domain/points'
import type { Transfer, User } from '@/domain/types'

interface Props {
  transfer: Transfer
  to: User
  /** 서버가 확정한 뒤 다시 읽은 잔액. 클라이언트가 계산하지 않는다 */
  balanceAfter: number | null
  onHome: () => void
}

/**
 * 끝났다 (여정 6).
 *
 * 사용자가 하려는 것은 확인하고 나가는 것이다. 그러니 화면은 확인에 필요한 것만
 * 두고 길을 막지 않는다.
 *
 * 여기 "완료"라고 쓸 수 있는 이유는 서버가 `confirmed` 를 보냈기 때문이다.
 * 클라이언트가 타이머로 추측해서 쓴 완료는 거짓 완료이고, 사용자는 그것을 믿고
 * 화면을 떠난다.
 */
export function Done({ transfer, to, balanceAfter, onHome }: Props) {
  const reduced = useReducedMotion()
  const tap = useTapScale()
  const isIssue = transfer.kind === 'issue'

  return (
    <Screen>
      <Body>
        <Gutter paddingTop="10">
          {/*
            체크는 한 번만 그려진다. 반복되는 축하 애니메이션은 두 번째부터
            정보가 아니라 지연이다.
          */}
          <motion.div
            initial={reduced ? false : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            <Box
              aria-hidden
              width="52px"
              height="52px"
              borderRadius="full"
              bg={isIssue ? 'issue.solid' : 'green.solid'}
              color={isIssue ? 'issue.contrast' : 'green.contrast'}
              display="grid"
              placeItems="center"
              fontSize="xl"
            >
              ✓
            </Box>
          </motion.div>

          <Text marginTop="4" fontSize="xl" fontWeight="semibold">
            {isIssue ? '발행했다' : '보냈다'}
          </Text>
          <Text fontSize="sm" color="fg.muted" marginTop="1">
            {to.name} {to.handle}
          </Text>

          <Card marginTop="6" padding="5">
            <Amount value={transfer.amount} size="medium" />

            {balanceAfter !== null ? (
              <Box
                marginTop="4"
                paddingTop="4"
                borderTopWidth="1px"
                borderColor="border"
                display="flex"
                justifyContent="space-between"
                alignItems="baseline"
                gap="3"
              >
                <Text fontSize="sm" color="fg.muted">
                  {isIssue ? '총 유통량' : '남은 잔액'}
                </Text>
                <Text fontSize="md" fontWeight="medium" fontVariantNumeric="tabular-nums">
                  {label(balanceAfter).grouped} {UNIT_SYMBOL}
                </Text>
              </Box>
            ) : null}
          </Card>
        </Gutter>
      </Body>

      <Footer>
        <MotionButton
          type="button"
          whileTap={tap}
          onClick={onHome}
          width="100%"
          minHeight="54px"
          borderRadius="l2"
          bg="blue.solid"
          color="blue.contrast"
          fontSize="md"
          fontWeight="medium"
        >
          확인
        </MotionButton>
      </Footer>
    </Screen>
  )
}

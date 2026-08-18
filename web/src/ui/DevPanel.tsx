import { useState } from 'react'
import { Box, chakra, Text } from '@chakra-ui/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DEFAULT_SIM, getSim, resetSim, setSim } from '@/api/sim'
import { resetLedger, setMyRole } from '@/api/mock'
import type { FailureCode, Role } from '@/domain/types'

/**
 * 개발자 패널 (여정 5 를 검증하기 위한 도구).
 *
 * 실패하지 않는 앱에서는 정직함을 시험할 수 없다. 지연과 실패를 주입할 수 없으면
 * "결과를 알 수 없을 때 추측하지 않는다" 같은 규칙은 코드에만 있고 화면에는 없다.
 *
 * 계약(`PointApi`) 밖의 것만 만진다. 실서버로 바꿔도 이 패널만 못 쓰게 될 뿐,
 * 앱은 그대로 돈다.
 */
const LATENCIES = [
  { label: '즉시', value: 0 },
  { label: '보통', value: 700 },
  { label: '느림', value: 3000 },
]

const FAILURES: { label: string; code: FailureCode }[] = [
  { label: '네트워크', code: 'NETWORK' },
  { label: '서버', code: 'SERVER' },
  { label: '잔액 부족', code: 'INSUFFICIENT_BALANCE' },
  { label: '발행 상한', code: 'CAP_EXCEEDED' },
  { label: '대상 없음', code: 'RECIPIENT_NOT_FOUND' },
]

interface Props {
  open: boolean
  onClose: () => void
  /** 원장을 리셋했다. 화면이 다시 읽어야 한다 */
  onLedgerReset: () => void
}

export function DevPanel({ open, onClose, onLedgerReset }: Props) {
  const reduced = useReducedMotion()
  const [, forceRender] = useState(0)
  const sim = getSim()

  const refresh = () => forceRender((n) => n + 1)

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.15 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10 }}
          />
          <motion.div
            initial={reduced ? { opacity: 0 } : { y: '100%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 460, damping: 40 }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 11 }}
          >
            <Box
              bg="bg.panel"
              borderTopRadius="l3"
              borderTopWidth="1px"
              borderColor="border"
              paddingInline="gutter"
              paddingTop="4"
              paddingBottom="calc(env(safe-area-inset-bottom) + 1rem)"
              maxHeight="80vh"
              overflowY="auto"
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom="4">
                <Text fontSize="md" fontWeight="semibold">
                  개발자 패널
                </Text>
                <chakra.button type="button" onClick={onClose} fontSize="sm" color="fg.muted">
                  닫기
                </chakra.button>
              </Box>

              <Group title="응답 지연">
                {LATENCIES.map((option) => (
                  <Chip
                    key={option.value}
                    active={sim.latencyMs === option.value}
                    onClick={() => {
                      setSim({ latencyMs: option.value, jitterMs: option.value === 0 ? 0 : 300 })
                      refresh()
                    }}
                  >
                    {option.label}
                  </Chip>
                ))}
              </Group>

              <Group title="다음 요청을 반드시 실패시킨다">
                {FAILURES.map((option) => (
                  <Chip
                    key={option.code}
                    active={sim.forceFailure === option.code}
                    onClick={() => {
                      setSim({ forceFailure: option.code })
                      refresh()
                    }}
                  >
                    {option.label}
                  </Chip>
                ))}
                <Chip
                  active={sim.forceFailure === null}
                  onClick={() => {
                    setSim({ forceFailure: null })
                    refresh()
                  }}
                >
                  해제
                </Chip>
              </Group>

              {/*
                단계 지연. 진행 화면을 눈으로 확인하려면 단계가 사람 속도로 넘어가야 한다.
                기본값으로는 4단계가 2초 만에 끝나서 무엇이 어떻게 채워지는지 볼 수 없다.
              */}
              <Group title="단계 진행 속도">
                <Chip
                  active={sim.stepDelaysMs.verify === DEFAULT_SIM.stepDelaysMs.verify}
                  onClick={() => {
                    setSim({ stepDelaysMs: DEFAULT_SIM.stepDelaysMs })
                    refresh()
                  }}
                >
                  기본
                </Chip>
                <Chip
                  active={sim.stepDelaysMs.verify === 2000}
                  onClick={() => {
                    setSim({
                      stepDelaysMs: { withdraw: 2000, request: 2000, verify: 2000, deposit: 2000 },
                    })
                    refresh()
                  }}
                >
                  각 2초
                </Chip>
              </Group>

              <Group title="무작위 실패율">
                {[0, 0.3, 1].map((rate) => (
                  <Chip
                    key={rate}
                    active={sim.failureRate === rate}
                    onClick={() => {
                      setSim({ failureRate: rate })
                      refresh()
                    }}
                  >
                    {Math.round(rate * 100)}%
                  </Chip>
                ))}
              </Group>

              <Group title="내 역할">
                {(['issuer', 'member'] as Role[]).map((role) => (
                  <Chip
                    key={role}
                    onClick={() => {
                      setMyRole(role)
                      onLedgerReset()
                    }}
                  >
                    {role === 'issuer' ? '발행자' : '일반'}
                  </Chip>
                ))}
              </Group>

              <Group title="원장">
                <Chip
                  onClick={() => {
                    resetLedger()
                    resetSim()
                    onLedgerReset()
                    refresh()
                  }}
                >
                  처음 상태로
                </Chip>
              </Group>
            </Box>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box marginBottom="4">
      <Text fontSize="xs" fontWeight="medium" color="fg.muted" marginBottom="2">
        {title}
      </Text>
      <Box display="flex" flexWrap="wrap" gap="2">
        {children}
      </Box>
    </Box>
  )
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      paddingInline="3"
      paddingBlock="2"
      borderRadius="full"
      fontSize="sm"
      borderWidth="1px"
      borderColor={active ? 'blue.solid' : 'border'}
      bg={active ? 'blue.subtle' : 'transparent'}
      color={active ? 'blue.fg' : 'fg.muted'}
    >
      {children}
    </chakra.button>
  )
}

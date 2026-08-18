import { useEffect, useState } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { mockApi } from '@/api/mock'
import { Amount } from '@/ui/Amount'
import { BackButton } from '@/ui/BackButton'
import { MotionButton, useTapScale } from '@/ui/motion'
import { Body, Gutter, Header, HeaderTitle, Screen } from '@/ui/Screen'
import type { Transfer, TransferStatus, User, UserId } from '@/domain/types'

interface Props {
  users: User[]
  me: User | null
  onOpen: (transfer: Transfer) => void
  onBack: () => void
}

/**
 * 내역 (여정 7).
 *
 * 여기서는 금액에 한글을 병기하지 않는다. 검증할 것이 없는 자리이기 때문이다.
 * 모든 줄에 한글이 붙으면 그건 신호가 아니라 배경이 되고, 정작 확정 화면에서
 * 병기가 눈에 띄지 않게 된다.
 */
export function History({ users, me, onOpen, onBack }: Props) {
  const [transfers, setTransfers] = useState<Transfer[] | null>(null)
  const tap = useTapScale()

  useEffect(() => {
    let alive = true
    void mockApi
      .history(50)
      .then((result) => {
        if (alive) setTransfers(result)
      })
      .catch(() => {
        if (alive) setTransfers([])
      })
    return () => {
      alive = false
    }
  }, [])

  const byId = new Map<UserId, User>(users.map((user) => [user.id, user]))
  if (me) byId.set(me.id, me)

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} />
        <HeaderTitle>내역</HeaderTitle>
      </Header>

      <Body>
        {transfers?.map((transfer) => (
          <MotionButton
            key={transfer.id}
            type="button"
            whileTap={tap}
            onClick={() => onOpen(transfer)}
            display="flex"
            alignItems="center"
            gap="3"
            width="100%"
            textAlign="left"
            paddingBlock="3"
            paddingInline="gutter"
            _active={{ bg: 'bg.muted' }}
          >
            <Box flex={1} minW={0}>
              {/*
                목록의 이름이 상세의 이름으로 이어진다. 같은 것이 자리를 옮겼다는
                사실이 보이면, 사용자는 자기가 방금 무엇을 눌렀는지 확인할 필요가 없다.
              */}
              <motion.div layoutId={`transfer-${transfer.id}-name`}>
                <Text
                  textStyle="name"
                  color={transfer.status === 'cancelled' ? 'fg.muted' : 'fg'}
                >
                  {byId.get(transfer.toId)?.name ?? '알 수 없음'}
                </Text>
              </motion.div>
              <StatusLine transfer={transfer} />
            </Box>

            <motion.div layoutId={`transfer-${transfer.id}-amount`}>
              <Amount
                value={transfer.amount}
                size="small"
                sign={transfer.kind === 'issue' ? 'in' : 'out'}
                muted={transfer.status === 'cancelled' || transfer.status === 'failed'}
              />
            </motion.div>
          </MotionButton>
        ))}

        {transfers?.length === 0 ? (
          <Gutter>
            <Text marginTop="8" fontSize="sm" color="fg.muted">
              아직 보낸 것이 없다.
            </Text>
          </Gutter>
        ) : null}
      </Body>
    </Screen>
  )
}

/**
 * 상태 한 줄.
 *
 * 확정된 것과 아직 아닌 것을 같은 색으로 두지 않는다. 목록에서 둘이 같아 보이면
 * 사용자는 진행 중인 이체를 끝난 것으로 읽는다.
 */
export function StatusLine({ transfer }: { transfer: Transfer }) {
  const { text, tone } = describeStatus(transfer.status)
  return (
    <Text fontSize="sm" color={tone}>
      {transfer.kind === 'issue' ? '발행 · ' : ''}
      {text}
      {transfer.confirmedAt ? ` · ${formatTime(transfer.confirmedAt)}` : ''}
    </Text>
  )
}

function describeStatus(status: TransferStatus): { text: string; tone: string } {
  switch (status) {
    case 'confirmed':
      return { text: '완료', tone: 'fg.muted' }
    case 'pending':
      return { text: '진행 중', tone: 'pending.fg' }
    case 'cancelled':
      return { text: '취소됨', tone: 'fg.subtle' }
    case 'failed':
      return { text: '실패', tone: 'red.fg' }
  }
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

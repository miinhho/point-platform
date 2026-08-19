import { Box } from '@chakra-ui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { meQuery, queryKeys } from '@/api/queries'
import { setUnauthenticatedHandler } from '@/api/http'
import { SignIn } from '@/features/auth'
import { History, HistoryDetail } from '@/features/history'
import { Bank, CreatePoint, Invite, Members, PointCreated } from '@/features/bank'
import { Settings } from '@/features/settings'
import {
  Confirm,
  EnterAmount,
  Failure,
  PickRecipient,
  Result,
  endFlowAtom,
  useSubmit,
} from '@/features/transfer'
import { Home } from '@/features/wallet'
import { ScreenTransition } from '@/shared/ui/ScreenTransition'
import type { ReactElement } from 'react'
import { TabBar } from './TabBar'
import { currentScreenAtom, goAtom, leaveFlowAtom, navAtom, resetNavAtom } from './atoms'
import { useAppBack } from './useAppBack'
import type { Screen, TabName } from './navigation'

/** 플로우 화면에서는 탭 바를 감춘다 — 되돌릴 수 없는 길 중간에 다른 곳으로 새게 두지 않는다 */
const FLOW: ReadonlySet<Screen['name']> = new Set([
  'pickRecipient',
  'enterAmount',
  'confirm',
  'result',
  'failure',
  'createPoint',
  'pointCreated',
  'invite',
  'members',
])

interface Actions {
  back: () => void
  submit: () => void
  check: () => void
  busy: boolean
  go: (screen: Screen) => void
  leaveFlow: () => void
}

/**
 * switch 라서 화면을 추가하면 컴파일이 빠뜨린 곳을 잡는다.
 * 조건부 나열로 두면 빠뜨린 화면이 조용히 빈 화면이 된다.
 */
function CurrentScreen({
  screen,
  actions,
}: {
  screen: Screen
  actions: Actions
}): ReactElement {
  switch (screen.name) {
    case 'pickRecipient':
      return <PickRecipient onBack={actions.back} />
    case 'enterAmount':
      return <EnterAmount onBack={actions.back} />
    case 'confirm':
      return <Confirm onBack={actions.back} onConfirm={actions.submit} busy={actions.busy} />
    case 'result':
      return <Result transfer={screen.transfer} />
    case 'failure':
      return <Failure onCheck={actions.check} />
    case 'historyDetail':
      return <HistoryDetail transferId={screen.transferId} onBack={actions.back} />
    case 'bank':
      return <Bank pointTypeId={screen.pointTypeId} onBack={actions.back} />
    case 'invite':
      return <Invite pointTypeId={screen.pointTypeId} onBack={actions.back} />
    case 'members':
      return (
        // 나가도 은행 페이지는 계속 보인다. 홈으로 돌려보내면 왜 못 쓰는지 물을 곳이 없다.
        <Members pointTypeId={screen.pointTypeId} onBack={actions.back} onLeft={actions.back} />
      )
    case 'createPoint':
      return (
        <CreatePoint
          onBack={actions.back}
          onCreated={(pointType) => actions.go({ name: 'pointCreated', pointType })}
        />
      )
    case 'pointCreated':
      return <PointCreated pointType={screen.pointType} onHome={actions.leaveFlow} />
  }
}

function TabRoot({ tab }: { tab: TabName }) {
  switch (tab) {
    case 'home':
      return <Home />
    case 'history':
      return <History />
    case 'settings':
      return <Settings />
  }
}

export default function App() {
  const session = useQuery(meQuery())
  const client = useQueryClient()
  const nav = useAtomValue(navAtom)
  const screen = useAtomValue(currentScreenAtom)
  const endFlow = useSetAtom(endFlowAtom)
  const resetNav = useSetAtom(resetNavAtom)
  const go = useSetAtom(goAtom)
  const leaveFlow = useSetAtom(leaveFlowAtom)
  const { submit, check, busy } = useSubmit()
  const back = useAppBack(busy)

  // 토큰이 죽으면 세션을 비운다. 여기서 재조회하거나 캐시를 지우면 그 요청이
  // 다시 401 을 받아 끝없이 돈다.
  useEffect(
    () => setUnauthenticatedHandler(() => client.setQueryData(queryKeys.me, null)),
    [client],
  )

  // 사람이 바뀌면 앞사람의 화면을 물려주지 않는다. 탭은 셸이, 초안은 transfer 가 갖는다.
  const userId = session.data?.id ?? null
  useEffect(() => {
    resetNav()
    endFlow()
  }, [userId, resetNav, endFlow])

  // 첫 판정 전에는 아무것도 그리지 않는다. 로그인 화면을 깜빡이게 두지 않는다.
  if (session.isPending) return null
  // 재조회가 실패해도 useQuery 는 이전 데이터를 유지한다. 세션은 그러면 안 된다 —
  // 증명하지 못하는 동안 남의 잔액이 화면에 남는다.
  if (session.isError || !session.data) return <SignIn />

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Box flex={1} css={{ minHeight: 0 }}>
        <ScreenTransition
          screenKey={screen?.name ?? `tab:${nav.tab}`}
          depth={nav.stack.length}
          morphGroup={
            screen?.name === 'historyDetail' || nav.tab === 'history' ? 'history' : undefined
          }
        >
          {screen ? (
            <CurrentScreen
              screen={screen}
              actions={{ back, submit, check, busy, go, leaveFlow }}
            />
          ) : (
            <TabRoot tab={nav.tab} />
          )}
        </ScreenTransition>
      </Box>

      {screen && FLOW.has(screen.name) ? null : <TabBar />}
    </Box>
  )
}

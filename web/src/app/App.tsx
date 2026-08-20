import { Box } from '@chakra-ui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { meQuery, queryKeys, setUnauthenticatedHandler } from '@/shared/api'
import { SignIn } from '@/features/auth'
import { Bank, CreatePoint, Invite, Members } from '@/features/bank'
import { History, HistoryDetail, IssueDetail } from '@/features/history'
import { Settings } from '@/features/settings'
import {
  ConfirmIssue,
  ConfirmTransfer,
  EnterIssueAmount,
  EnterTransferAmount,
  Failure,
  PickRecipient,
  Result,
  currentFlowAtom,
  endFlowAtom,
  flowAtom,
  useSubmit,
  type Flow,
} from '@/features/transfer'
import { Home } from '@/features/wallet'
import { ScreenTransition } from '@/shared/ui/ScreenTransition'
import type { ReactElement } from 'react'
import { TabBar } from './TabBar'
import { navAtom, resetNavAtom, routeAtom, toRootAtom } from './atoms'
import { useRouting } from './useRouting'
import type { Route } from './routes'

/**
 * 탭 바를 감추는 화면. 되돌릴 수 없는 길 중간에 다른 곳으로 새게 두지 않는다 —
 * 흐름 다섯은 애초에 라우트가 아니라 여기 없다.
 */
const TASK: ReadonlySet<Route['name']> = new Set(['createPoint', 'invite', 'members'])

/** 주소가 있는 화면. switch 라서 라우트를 늘리면 컴파일이 빠뜨린 곳을 잡는다 */
function RouteScreen({ route, back }: { route: Route; back: () => void }): ReactElement {
  switch (route.name) {
    case 'home':
      return <Home />
    case 'history':
      return <History />
    case 'settings':
      return <Settings />
    case 'historyDetail':
      return <HistoryDetail transferId={route.transferId} onBack={back} />
    case 'issueDetail':
      return <IssueDetail issueId={route.issueId} onBack={back} />
    case 'bank':
      return <Bank pointTypeId={route.pointTypeId} onBack={back} />
    case 'invite':
      return <Invite pointTypeId={route.pointTypeId} onBack={back} />
    case 'members':
      // 나가도 은행 페이지는 계속 보인다. 홈으로 돌려보내면 왜 못 쓰는지 물을 곳이 없다.
      return <Members pointTypeId={route.pointTypeId} onBack={back} onLeft={back} />
    case 'createPoint':
      return <CreatePoint onBack={back} />
  }
}

interface FlowActions {
  back: () => void
  submit: () => void
  check: () => void
  done: () => void
  busy: boolean
}

/** 주소가 없는 화면. 진행 중인 일이라 라우트 위에 겹친다 — docs/REBUILD.md 「주소」 */
function FlowScreen({ flow, actions }: { flow: Flow; actions: FlowActions }): ReactElement {
  switch (flow.step) {
    case 'pickRecipient':
      return <PickRecipient draft={flow.draft} onBack={actions.back} />
    // 발행은 이체가 아니다 — 흐름이 짧고 화면도 다르다. 계약: docs/API.md
    case 'enterAmount':
      return flow.draft.kind === 'issue' ? (
        <EnterIssueAmount draft={flow.draft} onBack={actions.back} />
      ) : (
        <EnterTransferAmount draft={flow.draft} onBack={actions.back} />
      )
    case 'confirm':
      return flow.draft.kind === 'issue' ? (
        <ConfirmIssue
          draft={flow.draft}
          onBack={actions.back}
          onConfirm={actions.submit}
          busy={actions.busy}
        />
      ) : (
        <ConfirmTransfer
          draft={flow.draft}
          onBack={actions.back}
          onConfirm={actions.submit}
          busy={actions.busy}
        />
      )
    case 'result':
      return <Result draft={flow.draft} result={flow.result} onDone={actions.done} />
    case 'failure':
      return (
        <Failure
          draft={flow.draft}
          failure={flow.failure}
          onCheck={actions.check}
          onDone={actions.done}
        />
      )
  }
}

export default function App() {
  const session = useQuery(meQuery())
  const client = useQueryClient()
  const nav = useAtomValue(navAtom)
  const route = useAtomValue(routeAtom)
  const flowState = useAtomValue(flowAtom)
  const flow = useAtomValue(currentFlowAtom)
  const endFlow = useSetAtom(endFlowAtom)
  const resetNav = useSetAtom(resetNavAtom)
  const toRoot = useSetAtom(toRootAtom)
  const { submit, check, busy } = useSubmit()

  useRouting(busy)

  // 토큰이 죽으면 세션을 비운다. 여기서 재조회하거나 캐시를 지우면 그 요청이
  // 다시 401 을 받아 끝없이 돈다.
  useEffect(
    () => setUnauthenticatedHandler(() => client.setQueryData(queryKeys.me, null)),
    [client],
  )

  /*
   * 사람이 바뀌면 앞사람의 화면을 물려주지 않는다.
   * 첫 렌더에서는 하지 않는다 — 주소로 들어온 화면을 그 자리에서 홈으로 되돌린다.
   */
  const userId = session.data?.id ?? null
  const lastUser = useRef(userId)
  useEffect(() => {
    if (lastUser.current === userId) return
    lastUser.current = userId
    resetNav()
    endFlow()
  }, [userId, resetNav, endFlow])

  // 첫 판정 전에는 아무것도 그리지 않는다. 로그인 화면을 깜빡이게 두지 않는다.
  if (session.isPending) return null
  // 재조회가 실패해도 useQuery 는 이전 데이터를 유지한다. 세션은 그러면 안 된다 —
  // 증명하지 못하는 동안 남의 잔액이 화면에 남는다.
  if (session.isError || !session.data) return <SignIn />

  // 흐름이 끝나면 홈으로 돌아온다 — docs/REBUILD.md 「주소」
  const done = () => {
    endFlow()
    toRoot()
  }
  const back = () => history.back()

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Box flex={1} css={{ minHeight: 0 }}>
        <ScreenTransition
          screenKey={flow ? `flow:${flow.step}` : `route:${route.name}`}
          depth={nav.stacks[nav.tab].length + (flowState ? flowState.past.length + 1 : 0)}
          morphGroup={
            route.name === 'historyDetail' ||
            route.name === 'issueDetail' ||
            route.name === 'history'
              ? 'history'
              : undefined
          }
        >
          {flow ? (
            <FlowScreen flow={flow} actions={{ back, submit, check, done, busy }} />
          ) : (
            <RouteScreen route={route} back={back} />
          )}
        </ScreenTransition>
      </Box>

      {flow || TASK.has(route.name) ? null : <TabBar />}
    </Box>
  )
}

import { Box } from '@chakra-ui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { meQuery, queryKeys } from '@/api/queries'
import { setUnauthenticatedHandler } from '@/api/http'
import { SignIn } from '@/features/auth'
import { History } from '@/features/history'
import { HistoryDetail } from '@/features/history'
import { Issuer } from '@/features/issuer'
import { Settings } from '@/features/settings'
import { Confirm } from '@/features/transfer'
import { EnterAmount } from '@/features/transfer'
import { Failure } from '@/features/transfer'
import { PickRecipient } from '@/features/transfer'
import { Result } from '@/features/transfer'
import {
  draftAtom,
  editAmountAtom,
  endFlowAtom,
  startTransferAtom,
} from '@/features/transfer'
import { useSubmit } from '@/features/transfer'
import { Home } from '@/features/wallet'
import { ScreenTransition } from '@/shared/ui/ScreenTransition'
import { TabBar } from './TabBar'
import { currentScreenAtom, navAtom } from './atoms'
import { depthOf } from './depth'
import { useAppBack } from './useAppBack'

/** 플로우 화면에서는 탭 바를 감춘다 — 되돌릴 수 없는 길 중간에 다른 곳으로 새게 두지 않는다 */
const FLOW: ReadonlySet<string> = new Set(['pickRecipient', 'enterAmount', 'confirm', 'result', 'failure'])

export default function App() {
  const session = useQuery(meQuery())
  const client = useQueryClient()
  const nav = useAtomValue(navAtom)
  const screen = useAtomValue(currentScreenAtom)
  const draft = useAtomValue(draftAtom)
  const endFlow = useSetAtom(endFlowAtom)
  const editAmount = useSetAtom(editAmountAtom)
  const startTransfer = useSetAtom(startTransferAtom)
  const { submit, check, busy } = useSubmit()
  const back = useAppBack(busy)

  // 토큰이 죽으면 세션을 비운다. 여기서 재조회하거나 캐시를 지우면 그 요청이
  // 다시 401 을 받아 끝없이 돈다.
  useEffect(
    () => setUnauthenticatedHandler(() => client.setQueryData(queryKeys.me, null)),
    [client],
  )

  // 첫 판정 전에는 아무것도 그리지 않는다. 로그인 화면을 깜빡이게 두지 않는다.
  if (session.isPending) return null
  // 재조회가 실패해도 useQuery 는 이전 데이터를 유지한다. 세션은 그러면 안 된다 —
  // 증명하지 못하는 동안 남의 잔액이 화면에 남는다.
  if (session.isError || !session.data) return <SignIn />

  const inFlow = screen !== null && FLOW.has(screen.name)

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Box flex={1} css={{ minHeight: 0 }}>
        <ScreenTransition
          screenKey={screen?.name ?? `tab:${nav.tab}`}
          depth={depthOf(screen)}
          morphGroup={screen?.name === 'historyDetail' || nav.tab === 'history' ? 'history' : undefined}
        >
          {screen === null && nav.tab === 'home' ? <Home /> : null}
          {screen === null && nav.tab === 'history' ? <History /> : null}
          {screen === null && nav.tab === 'settings' ? <Settings /> : null}

          {screen?.name === 'pickRecipient' ? <PickRecipient onBack={back} /> : null}
          {screen?.name === 'enterAmount' ? <EnterAmount onBack={back} /> : null}
          {screen?.name === 'confirm' ? (
            <Confirm onBack={back} onConfirm={submit} busy={busy} />
          ) : null}
          {screen?.name === 'result' ? (
            <Result transfer={screen.transfer} onHome={endFlow} />
          ) : null}
          {screen?.name === 'failure' ? (
            <Failure
              onCheck={check}
              onEditAmount={editAmount}
              onRepick={() =>
                draft ? startTransfer({ pointType: draft.pointType, kind: draft.kind }) : endFlow()
              }
              onHome={endFlow}
            />
          ) : null}
          {screen?.name === 'historyDetail' ? (
            <HistoryDetail transferId={screen.transferId} onBack={back} />
          ) : null}
          {screen?.name === 'issuer' ? <Issuer onBack={back} /> : null}
        </ScreenTransition>
      </Box>

      {inFlow ? null : <TabBar />}
    </Box>
  )
}

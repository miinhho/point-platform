import { Box } from '@chakra-ui/react'
import { useAtomValue, useSetAtom } from 'jotai'
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
  const nav = useAtomValue(navAtom)
  const screen = useAtomValue(currentScreenAtom)
  const draft = useAtomValue(draftAtom)
  const endFlow = useSetAtom(endFlowAtom)
  const editAmount = useSetAtom(editAmountAtom)
  const startTransfer = useSetAtom(startTransferAtom)
  const { submit, check, busy } = useSubmit()
  const back = useAppBack(busy)

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

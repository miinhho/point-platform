import { Box } from '@chakra-ui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { History } from '@/features/history/History'
import { HistoryDetail } from '@/features/history/HistoryDetail'
import { Issuer } from '@/features/issuer/Issuer'
import { Settings } from '@/features/settings/Settings'
import { Confirm } from '@/features/transfer/Confirm'
import { EnterAmount } from '@/features/transfer/EnterAmount'
import { Failure } from '@/features/transfer/Failure'
import { PickRecipient } from '@/features/transfer/PickRecipient'
import { Result } from '@/features/transfer/Result'
import {
  draftAtom,
  editAmountAtom,
  endFlowAtom,
  startTransferAtom,
} from '@/features/transfer/atoms'
import { useSubmit } from '@/features/transfer/useSubmit'
import { Home } from '@/features/wallet/Home'
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

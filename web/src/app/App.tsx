import { useAtomValue, useSetAtom } from 'jotai'
import { Confirm } from '@/features/transfer/Confirm'
import { EnterAmount } from '@/features/transfer/EnterAmount'
import { Failure } from '@/features/transfer/Failure'
import { PickRecipient } from '@/features/transfer/PickRecipient'
import { Result } from '@/features/transfer/Result'
import { editAmountAtom, endFlowAtom, startTransferAtom } from '@/features/transfer/atoms'
import { draftAtom } from '@/features/transfer/atoms'
import { useSubmit } from '@/features/transfer/useSubmit'
import { Home } from '@/features/wallet/Home'
import { ScreenTransition } from '@/shared/ui/ScreenTransition'
import { currentScreenAtom, navAtom } from './atoms'
import { depthOf } from './depth'
import { useAppBack } from './useAppBack'

export default function App() {
  const nav = useAtomValue(navAtom)
  const screen = useAtomValue(currentScreenAtom)
  const draft = useAtomValue(draftAtom)
  const endFlow = useSetAtom(endFlowAtom)
  const editAmount = useSetAtom(editAmountAtom)
  const startTransfer = useSetAtom(startTransferAtom)
  const { submit, check, busy } = useSubmit()
  // 요청이 나가는 동안 back 은 아무것도 하지 않는다.
  const back = useAppBack(busy)

  return (
    <ScreenTransition screenKey={screen?.name ?? `tab:${nav.tab}`} depth={depthOf(screen)}>
      {screen === null ? <Home /> : null}
      {screen?.name === 'pickRecipient' ? <PickRecipient onBack={back} /> : null}
      {screen?.name === 'enterAmount' ? <EnterAmount onBack={back} /> : null}
      {screen?.name === 'confirm' ? (
        <Confirm onBack={back} onConfirm={submit} busy={busy} />
      ) : null}
      {screen?.name === 'result' ? (
        <Result transferId={screen.transferId} onHome={endFlow} />
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
    </ScreenTransition>
  )
}

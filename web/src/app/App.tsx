import { useAtomValue } from 'jotai'
import { EnterAmount } from '@/features/transfer/EnterAmount'
import { PickRecipient } from '@/features/transfer/PickRecipient'
import { Home } from '@/features/wallet/Home'
import { ScreenTransition } from '@/shared/ui/ScreenTransition'
import { currentScreenAtom, navAtom } from './atoms'
import { depthOf } from './depth'
import { useAppBack } from './useAppBack'

export default function App() {
  const nav = useAtomValue(navAtom)
  const screen = useAtomValue(currentScreenAtom)
  // 쓰기가 붙는 슬라이스에서 뮤테이션의 isPending 을 넘긴다.
  const back = useAppBack(false)
  const key = screen?.name ?? `tab:${nav.tab}`

  return (
    <ScreenTransition screenKey={key} depth={depthOf(screen)}>
      {screen?.name === 'pickRecipient' ? <PickRecipient onBack={back} /> : null}
      {screen?.name === 'enterAmount' ? <EnterAmount onBack={back} /> : null}
      {screen === null ? <Home /> : null}
    </ScreenTransition>
  )
}

import { useCallback, useEffect, useReducer, useState } from 'react'
import { Confirm } from '@/screens/Confirm'
import { Done } from '@/screens/Done'
import { Failed } from '@/screens/Failed'
import { Sending } from '@/screens/Sending'
import { EnterAmount } from '@/screens/EnterAmount'
import { History } from '@/screens/History'
import { HistoryDetail } from '@/screens/HistoryDetail'
import { Home } from '@/screens/Home'
import { PickRecipient } from '@/screens/PickRecipient'
import { DevPanel } from '@/ui/DevPanel'
import { ScreenTransition } from '@/ui/ScreenTransition'
import { depthOf } from '@/ui/screenDepth'
import { useSystemBack } from '@/ui/useSystemBack'
import { mockApi } from '@/api/mock'
import type { Account, Ledger, Points, TransferKind, User } from '@/domain/types'
import {
  flowReducer,
  initialFlow,
  resolveBack,
  type FlowAction,
  type FlowState,
} from '@/flow/transferFlow'
import { useFlowRunner, type FlowRunner } from '@/flow/useFlowRunner'

interface HomeData {
  account: Account
  ledger: Ledger
  users: User[]
}

export default function App() {
  const [flow, dispatch] = useReducer(flowReducer, initialFlow)
  const [data, setData] = useState<HomeData | null>(null)
  const runner = useFlowRunner(flow, dispatch)
  const [devOpen, setDevOpen] = useState(false)
  // 원장을 리셋하면 화면이 들고 있던 값이 전부 거짓이 된다. 다시 읽게 만든다.
  const [reloadToken, setReloadToken] = useState(0)

  // 홈과 완료 화면에서 다시 읽는다. 확정된 이체가 잔액을 바꿨고, 클라이언트가 그 값을
  // 뺄셈으로 추측해서 보관하면 서버가 말하지 않은 숫자를 확정된 것처럼 보이게 된다.
  const needsFresh = flow.step === 'home' || flow.step === 'done'
  useEffect(() => {
    if (!needsFresh) return
    let alive = true
    void Promise.all([mockApi.me(), mockApi.ledger(), mockApi.users()]).then(
      ([account, ledger, users]) => {
        if (alive) setData({ account, ledger, users })
      },
    )
    return () => {
      alive = false
    }
  }, [needsFresh, reloadToken])

  /**
   * 시스템 back 을 상태 기계에 넘긴다.
   *
   * 웹에서는 `useSystemBack` 의 히스토리 덫이, WebView 안에서는 RN 의 `BackHandler`(Phase 7)가
   * 이 함수를 부른다. 어느 쪽이든 back 의 의미를 결정하는 곳은 한 군데다.
   * 반환값이 false 면 back 을 소비하지 않았다는 뜻이고, 셸이 기본 동작을 한다.
   */
  const handleBack = useCallback((): boolean => {
    const resolution = resolveBack(flow)
    if (resolution.kind === 'action') {
      dispatch(resolution.action)
      return true
    }
    // 'ignore' 도 소비한 것이다. 되돌릴 수 없는 구간에서 back 은 실행 취소가 아니다.
    return resolution.kind === 'ignore'
  }, [flow])

  useSystemBack(handleBack)

  return (
    <>
      <ScreenTransition
        screenKey={flow.step}
        depth={depthOf(flow.step)}
        morphGroup={flow.step === 'history' || flow.step === 'historyDetail' ? 'history' : undefined}
      >
        <Router
          flow={flow}
          data={data}
          dispatch={dispatch}
          runner={runner}
          onBack={handleBack}
          onOpenDevPanel={() => setDevOpen(true)}
        />
      </ScreenTransition>

      <DevPanel
        open={devOpen}
        onClose={() => setDevOpen(false)}
        onLedgerReset={() => {
          dispatch({ type: 'toHome' })
          setReloadToken((n) => n + 1)
        }}
      />
    </>
  )
}

/**
 * 이 화면에서 넘을 수 없는 값.
 *
 * 이체는 내 잔액, 발행은 남은 발행 여력이다. 서버가 최종 판단을 하지만,
 * 확정 화면까지 가서야 거절당하면 사용자는 자기가 뭘 잘못했는지 모른 채
 * 처음으로 돌아가게 된다.
 */
function ceilingFor(kind: TransferKind, data: HomeData | null): Points {
  if (!data) return 0
  return kind === 'issue' ? data.ledger.issueCap - data.ledger.totalIssued : data.account.balance
}

interface RouterProps {
  flow: FlowState
  data: HomeData | null
  dispatch: (action: FlowAction) => void
  runner: FlowRunner
  onBack: () => boolean
  onOpenDevPanel: () => void
}

function Router({ flow, data, dispatch, runner, onBack, onOpenDevPanel }: RouterProps) {
  switch (flow.step) {
    case 'home':
      return (
        <Home
          account={data?.account ?? null}
          ledger={data?.ledger ?? null}
          recent={data?.users ?? []}
          onQuickPick={(to) => dispatch({ type: 'quickPick', kind: 'transfer', to })}
          onOpenPicker={() => dispatch({ type: 'start', kind: 'transfer' })}
          onOpenIssue={() => dispatch({ type: 'start', kind: 'issue' })}
          onOpenDevPanel={onOpenDevPanel}
          onOpenHistory={() => dispatch({ type: 'openHistory' })}
        />
      )

    case 'history':
      return (
        <History
          users={data?.users ?? []}
          me={data?.account.user ?? null}
          onOpen={(transfer) => dispatch({ type: 'openHistoryDetail', transfer })}
          onBack={onBack}
        />
      )

    case 'historyDetail':
      return (
        <HistoryDetail
          transfer={flow.transfer}
          to={data?.users.find((user) => user.id === flow.transfer.toId) ?? null}
          from={data?.account.user ?? null}
          onBack={onBack}
        />
      )

    case 'pickRecipient':
      return (
        <PickRecipient
          kind={flow.kind}
          query={flow.query}
          onQuery={(query) => dispatch({ type: 'setQuery', query })}
          onPick={(to) => dispatch({ type: 'pick', to })}
          onBack={onBack}
        />
      )

    case 'enterAmount':
      return (
        <EnterAmount
          kind={flow.kind}
          to={flow.to}
          raw={flow.raw}
          ceiling={ceilingFor(flow.kind, data)}
          onDigit={(digit) => dispatch({ type: 'digit', digit })}
          onBackspace={() => dispatch({ type: 'backspace' })}
          onClear={() => dispatch({ type: 'clearAmount' })}
          onNext={() => dispatch({ type: 'toConfirm' })}
          onBack={onBack}
        />
      )

    case 'confirm':
      return (
        <Confirm
          kind={flow.draft.kind}
          to={flow.draft.to}
          amount={flow.draft.amount}
          account={data?.account ?? null}
          ledger={data?.ledger ?? null}
          busy={runner.busy}
          onConfirm={runner.submit}
          onBack={onBack}
        />
      )

    case 'sending':
      return <Sending transfer={flow.transfer} to={flow.draft.to} onCancel={runner.cancel} />

    case 'done':
      return (
        <Done
          transfer={flow.transfer}
          to={flow.draft.to}
          balanceAfter={
            flow.draft.kind === 'issue'
              ? (data?.ledger.totalIssued ?? null)
              : (data?.account.balance ?? null)
          }
          onHome={() => dispatch({ type: 'toHome' })}
        />
      )

    case 'failed':
      return (
        <Failed
          kind={flow.draft.kind}
          to={flow.draft.to}
          amount={flow.draft.amount}
          failure={flow.failure}
          onRetry={() => dispatch({ type: 'retry' })}
          onEditAmount={() => dispatch({ type: 'editAmount' })}
          onRepick={() => dispatch({ type: 'start', kind: flow.draft.kind })}
          onHome={() => dispatch({ type: 'toHome' })}
        />
      )
  }
}

import type { FlowState } from '@/flow/transferFlow'

/**
 * 여정에서의 깊이. 화면 전환 방향을 정하는 유일한 근거다.
 *
 * 라우터의 history 길이로 방향을 정하면, 상태 기계가 history 를 쓰지 않는 이 앱에서는
 * 항상 "앞으로"가 된다. 그래서 여정의 순간마다 깊이를 직접 정한다.
 */
const DEPTH: Record<FlowState['step'], number> = {
  home: 0,
  history: 1,
  historyDetail: 2,
  pickRecipient: 1,
  enterAmount: 2,
  confirm: 3,
  // 확정을 누른 뒤는 되돌아오는 길이 없다. 그래도 앞으로 나아간 것은 맞으므로
  // 깊이는 계속 커진다 — 사용자가 "진행했다"고 느끼는 방향과 일치시킨다.
  sending: 4,
  done: 5,
  failed: 5,
}

export function depthOf(step: FlowState['step']): number {
  return DEPTH[step]
}

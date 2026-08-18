import type { Screen } from './navigation'

const DEPTH: Record<Screen['name'], number> = {
  pickRecipient: 1,
  enterAmount: 2,
  confirm: 3,
  result: 4,
  failure: 4,
  historyDetail: 1,
  issuer: 1,
}

/** 커지면 앞으로, 작아지면 뒤로. 탭 뿌리가 0 이다. */
export function depthOf(screen: Screen | null): number {
  return screen ? DEPTH[screen.name] : 0
}

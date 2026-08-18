import type { FailureCode } from '@/domain/types'

// 실패를 넣을 수 없으면 정직함을 시험할 수 없다. 실서버에는 대응물이 없다.
export interface SimConfig {
  latencyMs: number
  /** 지연에 더할 무작위 폭 */
  jitterMs: number
  /** 0.0 ~ 1.0 */
  failureRate: number
  /** 지정하면 다음 요청이 반드시 이 코드로 실패한다. 한 번 쓰면 소모된다 */
  forceFailure: FailureCode | null
  /**
   * 서버는 처리했는데 응답이 유실된 경우. 계약 밖의 주입이다.
   * `forceFailure: 'NETWORK'` 는 항상 "아무것도 안 만든 상태" 라서 멱등성을 시험하지 못한다.
   */
  loseNextResponse: boolean
}

export const DEFAULT_SIM: SimConfig = {
  latencyMs: 400,
  jitterMs: 200,
  failureRate: 0,
  forceFailure: null,
  loseNextResponse: false,
}

let current: SimConfig = { ...DEFAULT_SIM }

export function getSim(): SimConfig {
  return current
}

export function setSim(patch: Partial<SimConfig>): SimConfig {
  current = { ...current, ...patch }
  return current
}

export function resetSim(): SimConfig {
  current = { ...DEFAULT_SIM }
  return current
}

export function simulatedLatency(): number {
  return current.latencyMs + Math.random() * current.jitterMs
}

/** 쓰기가 끝난 뒤 응답을 버릴 것인가. 한 번만 쓰인다. */
export function drawResponseLoss(): boolean {
  if (!current.loseNextResponse) return false
  current = { ...current, loseNextResponse: false }
  return true
}

/** 이번 요청이 주입된 실패에 걸렸는가. `forceFailure` 는 한 번만 쓰인다. */
export function drawFailure(): FailureCode | null {
  if (current.forceFailure) {
    const code = current.forceFailure
    current = { ...current, forceFailure: null }
    return code
  }
  if (current.failureRate > 0 && Math.random() < current.failureRate) {
    return Math.random() < 0.5 ? 'NETWORK' : 'SERVER'
  }
  return null
}

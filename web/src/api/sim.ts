// Mock 시뮬레이션 설정.
//
// Mock 은 동시성 충돌을 만들지 않는다 — 요청은 직렬 처리된다.
// 대신 지연과 실패를 주입할 수 있어야 한다. 그것 없이는 헌법 10~12조를
// 검증할 방법이 없다. 실패하지 않는 앱에서는 정직함을 시험할 수 없다.

import type { FailureCode, ProgressStep } from '../domain/types'

export interface SimConfig {
  /** 요청 왕복 지연 */
  latencyMs: number
  /** 지연에 더할 무작위 폭 */
  jitterMs: number
  /** 0.0 ~ 1.0. 무작위 실패 확률 */
  failureRate: number
  /** 지정하면 다음 요청이 반드시 이 코드로 실패한다 */
  forceFailure: FailureCode | null
  /**
   * 진행 단계별 지연 (헌법 10조).
   *
   * 스피너는 정보량이 0 이므로 쓰지 않는다. 이체는 실제로 네 단계를 거치고,
   * 각 단계가 끝날 때마다 화면에 반영된다. Mock 은 지연으로 흉내내되
   * 단계를 건너뛰거나 가짜로 먼저 완료 표시하지 않는다 (헌법 11조).
   */
  stepDelaysMs: Record<ProgressStep, number>
}

export const DEFAULT_SIM: SimConfig = {
  latencyMs: 700,
  jitterMs: 300,
  failureRate: 0,
  forceFailure: null,
  stepDelaysMs: {
    withdraw: 300,
    request: 500,
    verify: 900,
    deposit: 400,
  },
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
  const { latencyMs, jitterMs } = current
  return latencyMs + Math.random() * jitterMs
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 이번 요청이 주입된 실패에 걸렸는지. forceFailure 는 한 번 쓰면 소모된다. */
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

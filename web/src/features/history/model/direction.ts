import type { TFunction } from 'i18next'
import type { Transfer } from '@/shared/contract'

/**
 * 상대와 방향을 한 줄로. **방향은 서버가 실어 준 `outgoing` 이 답한다** — 화면이 자기
 * id 를 상대 id 와 맞춰 보고 정하지 않는다(docs/API.md).
 *
 * 목록과 상세가 같은 문자열을 써야 한다. 다르면 줄을 눌러 펼치는 전환에서 글자가 바뀌어
 * 「같은 것이 커진 것」으로 안 읽힌다 — docs/MOTION.md 「공간의 연속」
 */
export function counterpartyLine(t: TFunction, transfer: Transfer): string {
  const name = transfer.counterparty.name
  return t(transfer.outgoing ? 'history.toName' : 'history.fromName', { name })
}

/** 시각 라벨도 방향을 따른다. 받은 이체에 「보낸 시각」이 붙으면 내가 보낸 것으로 읽힌다 */
export const timeLabelKey = (transfer: Transfer): 'history.sentAt' | 'history.receivedAt' =>
  transfer.outgoing ? 'history.sentAt' : 'history.receivedAt'

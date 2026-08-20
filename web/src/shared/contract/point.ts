import type { Points, PointTypeId, UserId } from './ids'

/** `public` 에는 회원이 없다. 관문이 없는데 통과 기록을 두면 그것은 공개가 아니다. */
export type PointVisibility = 'public' | 'private'

/** 색으로 무엇을 가르지 않는다 — 그래서 늘려도 된다. 대비는 contrast.test.ts 가 잰다 */
export type PointAccent =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'teal'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'lime'

/**
 * 고를 수 있는 이모지. 자유 입력을 받지 않는 이유는 이모지가 한 글자처럼 보여도
 * 결합된 여러 코드포인트일 수 있어서다(피부색·ZWJ·이형 선택자) — 그러면 길이
 * 검사·너비·폰트 대체가 기기마다 갈린다. 국기는 넣지 않는다: 무엇을 목록에 넣을지가
 * 정치적 판단이 된다. 계약: docs/API.md
 */
export const ALLOWED_EMOJI = [
  '🍞', '🍰', '🍜', '🍕', '🍔', '🍣', '☕', '🍺', '🧃', '🍎',
  '🥕', '🌽', '🏪', '🏬', '🏫', '🏥', '🏦', '🎪', '🎨', '🎬',
  '🎮', '🎵', '📚', '✏️', '🚲', '🚌', '🧺', '🪴', '🌱', '🌊',
  '🔥', '⭐', '🌙', '☀️', '⛰️', '🧭', '🐶', '🐱', '🐰', '🐻',
  '🐼', '🦊', '🐧', '🐢', '🐝', '🦋', '🐟', '🌸', '⚽', '🏀',
  '🎾', '🏐', '🎯', '🎲', '🧩', '🎁', '💡', '🔧', '🗝️', '🔔',
] as const

/** 발행자 한 명이 발행 권한을 가진 화폐. 이체는 같은 종류끼리만 일어난다. */
export interface PointType {
  id: PointTypeId
  name: string
  /**
   * 좁은 자리에서 이름 대신 쓰는 표식. **유일하지 않다** — 겹쳐도 된다.
   * 이모지로 무엇을 가르지 않는다. 그 일은 발행자 핸들이 한다 (여정 10).
   */
  emoji: string
  issuerId: UserId
  /** 이름이 겹치는 포인트를 가르는 부제. 화면이 사용자 목록을 뒤지지 않게 서버가 준다. */
  issuerName: string
  /** 발행자의 핸들. 이름·기호·색과 달리 흉내낼 수 없어 사칭 판단의 근거가 된다. */
  issuerHandle: string
  /** 원장 전체에서 이 이름을 쓰는 포인트가 둘 이상인가. 내 지갑에는 한쪽만 올 수 있다. */
  nameIsShared: boolean
  /** 내가 이 포인트를 발행할 수 있는가. 클라이언트가 판정하지 않는다. */
  canIssue: boolean
  /** 지금 더 발행할 수 있는 양. 상한 외의 규칙이 생기면 서버만 안다. */
  issuableHeadroom: Points
  /** 발행자가 정한 색. 화면이 배정하면 순서가 바뀔 때 표식 노릇을 못 한다. */
  accent: PointAccent
  totalIssued: Points
  issueCap: Points
  /** 만들어진 시각. 오래된 것은 흉내낼 수 없다. */
  createdAt: string
  /**
   * 발행자가 적는 소개. 상한과 달리 바꿀 수 있다 — 약속이 아니라 소개다.
   * **앱이 보증하지 않는다.** 화면은 이 글이 사실보다 먼저 읽히지 않게 한다.
   *
   * 「없음」은 `null` 하나다. 빈 문자열과 둘로 두면 한쪽만 보는 코드가 생긴다.
   */
  description: string | null
  /** 비공개 은행의 회원 수. 공개면 `null` — 공개 은행에는 회원 개념이 없다. */
  memberCount: number | null
  /** 창설 시 정해지고 나중에 바꿀 수 없다 — 바꾸는 것은 설정 변경이 아니라 사람에게 일어나는 일이다. */
  visibility: PointVisibility
}

/**
 * 그 줄이 어느 포인트인가. **지갑에서 찾으면 안 된다** — 모수가 다르다. 지갑은
 * 「잔액 > 0 이거나 내가 발행자」로 거르고 내역은 관여 여부로 거른다. 받은 포인트를
 * 전액 보내면 그 순간 지갑에서 빠지고 방금 만든 이체 줄만 내역에 남는다.
 *
 * 목록만이 아니라 **단건 조회도 싣는다.** 목록만 고치면 한 화면에서 확인한 것이 다음
 * 화면에서 부정된다 — 내역에서 「솔카페」라고 읽고 눌렀는데 상세에는 이름이 없다.
 *
 * 표기라 「일어난 때의 값」이 아니라 지금 값이다 — 수가 아니다. 계약: docs/API.md
 */
export interface PointMark {
  name: string
  emoji: string
  accent: PointAccent
  nameIsShared: boolean
  issuerHandle: string
}

/**
 * 상한이 바뀐 사건. 되돌리는 것이 아니라 또 하나의 변경으로만 이어진다 —
 * docs/JOURNEY.md 여정 9
 */
export interface CapChange {
  id: string
  idempotencyKey: string
  pointTypeId: PointTypeId
  /** 바꾼 사람. 그 포인트의 발행자다 */
  byId: UserId
  previousCap: Points
  issueCap: Points
  changedAt: string
}

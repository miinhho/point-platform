// 계약: docs/API.md

/** 정수. 최소 단위 1. 소수점을 허용하지 않는다. */
export type Points = number

export type UserId = string
export type PointTypeId = string
export type TransferId = string
export type IssueId = string

export interface User {
  id: UserId
  name: string
  /** 동명이인을 가르는 유일한 문자열. */
  handle: string
  /** 원장 전체에서 이 이름을 쓰는 사용자가 둘 이상인가. 받은 목록 안에서 세면 방어가 꺼진다. */
  nameIsShared: boolean
}

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
   */
  description: string
  /** 비공개 은행의 회원 수. 공개면 `null` — 공개 은행에는 회원 개념이 없다. */
  memberCount: number | null
  /** 창설 시 정해지고 나중에 바꿀 수 없다 — 바꾸는 것은 설정 변경이 아니라 사람에게 일어나는 일이다. */
  visibility: PointVisibility
}

/** `public` 에는 회원이 없다. 관문이 없는데 통과 기록을 두면 그것은 공개가 아니다. */
export type PointVisibility = 'public' | 'private'

/** 색으로 무엇을 가르지 않는다 — 그래서 늘려도 된다. 대비는 contrast.test.ts 가 잰다 */
/**
 * 고를 수 있는 이모지. 자유 입력을 받지 않는 이유는 이모지가 한 글자처럼 보여도
 * 결합된 여러 코드포인트일 수 있어서다(피부색·ZWJ·이형 선택자) — 그러면 길이
 * 검사·너비·폰트 대체가 기기마다 갈린다. 국기는 넣지 않는다: 무엇을 목록에 넣을지가
 * 정치적 판단이 된다. 계약: docs/API.md
 */
export const ALLOWED_EMOJI = [
  '🍞',
  '🍎',
  '🍜',
  '🍕',
  '🍵',
  '🌱',
  '🌙',
  '🔥',
  '💧',
  '🌊',
  '🌸',
  '🍀',
  '🎵',
  '📚',
  '🎨',
  '🎬',
  '🏠',
  '🚲',
  '🎁',
  '🐝',
  '🐟',
  '🔑',
  '🚀',
  '💎',
] as const

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

export interface Balance {
  pointType: PointType
  amount: Points
  /** 지금 보낼 수 있는 양. 보류금이 생기면 `amount` 와 달라진다. */
  sendable: Points
  /**
   * 이 포인트로 아직 보내지도 사지도 않았다. 서버가 판정한다 — 클라이언트가 기억하면
   * 폰에서 확인한 것이 태블릿에서는 처음이 된다. 계약: docs/API.md
   */
  neverSpent: boolean
}

export interface Wallet {
  user: User
  balances: Balance[]
}

/**
 * 런타임 목록이 진실이고 타입은 여기서 파생된다. 둘을 따로 두면 코드를 추가할 때
 * 한쪽을 빠뜨리고, 그러면 서버가 보낸 코드가 조용히 `SERVER` 로 떨어진다.
 */
export const FAILURE_CODES = [
  /** 핸들이나 암호가 틀렸다 */
  'BAD_CREDENTIALS',
  /** 토큰이 없거나 만료됐다. 화면은 로그인으로 보낸다 */
  'UNAUTHENTICATED',
  'INSUFFICIENT_BALANCE',
  'CAP_EXCEEDED',
  'NOT_ISSUER',
  /** 은행장은 나가거나 내보내질 수 없다. 발행할 사람이 없는 은행이 된다 */
  'ISSUER_CANNOT_LEAVE',
  /** 비공개 은행의 회원이 아니다. 받는 쪽의 코드와 가려야 할 것이 다르다 */
  'NOT_MEMBER',
  /** 공개 은행이라 회원 명부가 없다. 비어 있는 것이 아니라 개념이 없는 것이다 */
  'NOT_A_PRIVATE_BANK',
  /** 이 서버에 없는 경로. 고칠 입력이 없으므로 형식 오류가 아니다 */
  'UNKNOWN_ENDPOINT',
  'RECIPIENT_NOT_FOUND',
  'POINT_TYPE_NOT_FOUND',
  /** 이미 발행한 양보다 낮은 상한 */
  'CAP_BELOW_ISSUED',
  /** 본문이 계약과 다르다. 화면에서는 도달하지 않는다 */
  'MALFORMED_REQUEST',
  /** 그 이체가 없거나 내 것이 아니다 */
  'TRANSFER_NOT_FOUND',
  /** 결과를 알 수 없다. 이 둘만 그렇다 */
  'NETWORK',
  'SERVER',
] as const

export type FailureCode = (typeof FAILURE_CODES)[number]

/**
 * 서버가 처리했는지 아는가. **코드에서 파생하지 않는다** — 코드를 늘릴 때마다
 * 클라이언트가 표를 함께 늘려야 하고, 빠뜨리면 확정된 실패를 「어디까지 갔는지
 * 알 수 없어요」라고 말하게 된다. 계약: docs/API.md
 */
export type FailureOutcome = 'none' | 'unknown'

export interface Failure {
  code: FailureCode
  outcome: FailureOutcome
  message: string
}

/**
 * 이체의 상대. 누구인지는 원장의 성질이라 서버가 싣는다 — 클라이언트가 `toId` 로
 * 사용자 목록을 뒤지면 목록에 없는 순간 조용히 틀린다. 계약: docs/API.md
 */
export interface Counterparty {
  name: string
  handle: string
  nameIsShared: boolean
}

/** 확정된 이체만 존재한다. 실패는 기록이 아니라 응답이다 — docs/API.md */
export interface Transfer {
  id: TransferId
  idempotencyKey: string
  pointTypeId: PointTypeId
  fromId: UserId
  toId: UserId
  amount: Points
  /** 누구인지는 원장의 성질이다. 화면이 목록을 뒤져 맞추면 조용히 틀린다 */
  counterparty: Counterparty
  createdAt: string
  confirmedAt: string
}

/**
 * 발행. **이체가 아니다** — 중심 필드인 「누구에게」가 없다. 한동안 `Transfer.kind` 로
 * 갈랐는데 그러면 빈 칸이 생기고, 빈 칸은 채워지려 한다: 「보낸 사람: 발행(무에서)」과
 * 「나」가 그 결과였다. 계약: docs/API.md 「발행은 이체가 아니다」
 */
export interface Issue {
  id: IssueId
  idempotencyKey: string
  pointTypeId: PointTypeId
  /** 발행자. 받는 사람이기도 하다 — 한 사람이라 칸이 하나다 */
  issuerId: UserId
  amount: Points
  /** 이 발행 **직후**의 유통량. 지금 값이 아니다 — 일어난 일은 일어난 때의 값을 갖는다 */
  totalIssuedAfter: Points
  /** 그때의 상한. 나중에 바뀌어도 이 값은 안 바뀐다 */
  issueCapAt: Points
  confirmedAt: string
}

/**
 * 비공개 은행으로의 초대. 상태를 최소로 갖는다 — 거절도 취소도 없다.
 * 무시하면 그만이고, 거절을 두면 「거절함」이라는 상태와 그것을 되돌리는 경로가
 * 따라온다. 계약: docs/API.md
 */
export interface Invite {
  id: string
  /** 받는 사람이 판단할 것이 여기 다 있다 */
  pointType: PointType
  /** 초대한 사람. 은행장이다 */
  byId: UserId
  byHandle: string
  createdAt: string
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

/**
 * 내역 한 줄. 서버가 두 종류를 시간순으로 섞어 준다 — 클라이언트가 두 목록을
 * 받아 합치면 각 목록의 `limit` 경계에서 항목이 사라진다.
 *
 */
export type HistoryEntry =
  | { type: 'transfer'; transfer: Transfer }
  | { type: 'issue'; issue: Issue }
  | { type: 'capChange'; capChange: CapChange }

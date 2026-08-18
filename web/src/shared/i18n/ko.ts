
// UI 문체는 해요체. 규칙은 copy.test.ts 가 지킨다.
export const ko = {
  common: {
    loading: '불러오는 중',
    retry: '다시 시도',
    back: '뒤로',
    ok: '확인',
  },

  auth: {
    title: '포인트',
    subtitle: '핸들과 암호로 들어가요',
    handle: '핸들',
    handlePlaceholder: '@minho',
    password: '암호',
    submit: '들어가기',
    /** Mock 전용. 실서버에는 없어요 */
    hint: 'Mock 이라 암호는 모두 point 예요',
    logout: '로그아웃',
  },

  tab: {
    home: '홈',
    history: '내역',
    settings: '설정',
  },

  history: {
    title: '내역',
    empty: '아직 보낸 것이 없어요',
    issued: '발행',
    detailTitleTransfer: '이체 내역',
    detailTitleIssue: '발행 내역',
    from: '보낸 사람',
    fromIssue: '발행 (무에서)',
    to: '받은 사람',
    at: '보낸 시각',
    requestKey: '요청 키',
    me: '나',
  },

  settings: {
    title: '설정',
    account: '내 계정',
    colorMode: '화면 밝기',
    colorModeSystem: '자동',
    colorModeLight: '밝게',
    colorModeDark: '어둡게',
    dev: '개발자',
    devLatency: '응답 지연',
    devLatencyInstant: '즉시',
    devLatencyNormal: '보통',
    devLatencySlow: '느림',
    devFailure: '다음 요청 실패',
    devFailureNone: '없음',
    devFailureNetwork: '네트워크',
    devFailureServer: '서버',
    devFailureLost: '응답 유실',
    devReset: '원장 초기화',
    devNote: 'Mock 서버 전용이에요. 실서버에는 없어요',
  },

  issuer: {
    title: '발행 관리',
    supply: '총 유통량',
    cap: '발행 상한',
    headroom: '남은 여력',
    issue: '발행하기',
  },

  home: {
    title: '내 포인트',
    issue: '발행 관리',
    empty: '아직 받은 포인트가 없어요',
    /** 발행 권한이 있는 포인트에만 붙는다 */
    issuerBadge: '내가 발행',
    /** 이름이 겹칠 때만 붙는 부제 */
    issuedBy: '{{name}} 발행',
    zeroBalance: '보낼 잔액이 없어요',
    loadFailed: '지갑을 불러오지 못했어요',
  },

  pick: {
    titleTransfer: '누구에게 보낼까요?',
    searchPlaceholder: '이름 또는 핸들',
    recentSection: '최근 보낸 사람',
    allSection: '전체',
    /** 비교하라고 최근 묶음으로 끌어올린 줄 */
    notSentBefore: '보낸 적 없음',
    notFound: '"{{query}}"로 찾은 사람이 없어요',
    empty: '보낼 수 있는 사람이 없어요',
  },

  amount: {
    ceiling: '{{amount}}만큼 보낼 수 있어요',
    ceilingIssue: '{{amount}}만큼 발행할 수 있어요',
    over: '잔액을 넘었어요. {{amount}}까지 보낼 수 있어요',
    overIssue: '발행 여력을 넘었어요. {{amount}}까지 발행할 수 있어요',
    next: '보내기 확인',
    nextIssue: '발행 확인',
    clear: '전체삭제',
    backspace: '한 자 지우기',
  },

  confirm: {
    titleTransfer: '이렇게 보낼까요?',
    titleIssue: '이렇게 발행할까요?',
    holdTransfer: '꾹 눌러서 보내기',
    holdIssue: '꾹 눌러서 발행',
    to: '받는 사람',
    balanceNow: '지금 잔액',
    balanceAfter: '보낸 뒤 남는 잔액',
    /** 받는 사람이 이 포인트를 처음 받는다. 경고가 아니라 사실이다 */
    firstTime: '이 포인트를 처음 받아요',
    /** 발행은 색이 아니라 구조로 구분한다. 화면 위에 늘 붙어 있는 띠다 */
    issueBanner: '발행',
    supplyNow: '지금 총 유통량',
    supplyAfter: '발행 뒤 총 유통량',
    supplyChange: '유통량 변화',
    supplyFirst: '첫 발행',
    cap: '발행 상한',
  },

  result: {
    titleTransfer: '보냈어요',
    titleIssue: '발행했어요',
    remaining: '남은 잔액',
    supply: '총 유통량',
    /** 상태 변화를 소리로도 알린다 */
    announceTransfer: '보냈어요. 남은 잔액 {{balance}}',
  },

  failure: {
    heading: '보내지 못했어요',
    whereLabel: '포인트는 여기 있어요',
    /** 결과를 모를 때. 단정하지 않는다는 뜻이다 */
    unknownLabel: '지금 확실한 것',
    draftLabel: '보내려던 것',
    /** 결과를 모를 때는 "다시 보내기" 가 아니다 */
    check: '확인하기',
    editAmount: '금액 고치기',
    repick: '받는 사람 다시 고르기',
    home: '홈으로',
    INSUFFICIENT_BALANCE: {
      title: '잔액이 부족해요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    CAP_EXCEEDED: {
      title: '발행 상한을 넘어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요. 총 유통량은 그대로예요',
    },
    NOT_ISSUER: {
      title: '이 포인트는 발행할 수 없어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요. 총 유통량은 그대로예요',
    },
    RECIPIENT_NOT_FOUND: {
      title: '받는 사람을 찾을 수 없어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    POINT_TYPE_NOT_FOUND: {
      title: '이 포인트를 찾을 수 없어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    BAD_CREDENTIALS: {
      title: '핸들이나 암호가 맞지 않아요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    UNAUTHENTICATED: {
      title: '다시 로그인해야 해요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    NETWORK: {
      title: '서버에 닿지 못했어요',
      whereTransfer: '보내졌는지 알 수 없어요. 다시 시도해도 두 번 나가지 않아요',
      whereIssue: '발행됐는지 알 수 없어요. 다시 시도해도 두 번 발행되지 않아요',
    },
    SERVER: {
      title: '처리하지 못했어요',
      whereTransfer: '어디까지 갔는지 알 수 없어요. 다시 시도해도 두 번 나가지 않아요',
      whereIssue: '어디까지 갔는지 알 수 없어요. 다시 시도해도 두 번 발행되지 않아요',
    },
  },
} as const

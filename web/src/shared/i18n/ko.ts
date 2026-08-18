
// UI 문체는 해요체. 규칙은 copy.test.ts 가 지킨다.
export const ko = {
  common: {
    back: '뒤로',
    close: '닫기',
    ok: '확인',
    retry: '다시 시도',
    home: '홈으로',
    loading: '불러오는 중',
  },

  tab: {
    home: '홈',
    history: '내역',
    settings: '설정',
  },

  home: {
    title: '내 포인트',
    empty: '가진 포인트가 없어요',
    /** 발행자에게만 보인다 */
    issuerBadge: '발행자',
    issuerHeadroom: '남은 발행 여력 {{amount}}',
    send: '보내기',
    openIssuer: '발행 관리',
    historyLink: '내역 보기',
  },

  pick: {
    titleTransfer: '누구에게 보낼까요?',
    titleIssue: '누구에게 발행할까요?',
    searchPlaceholder: '이름 또는 핸들',
    recentSection: '최근 보낸 사람',
    allSection: '전체',
    /** 동명이인 묶음 안내. 이 화면의 존재 이유다 */
    sameName: '같은 이름 {{count}}명 · 핸들로 구분해요',
    /** 비교하라고 최근 묶음으로 끌어올린 줄 */
    notSentBefore: '보낸 적 없음',
    notFound: '"{{query}}"로 찾은 사람이 없어요',
    empty: '보낼 수 있는 사람이 없어요',
  },

  amount: {
    ceilingTransfer: '보낼 수 있어요',
    ceilingIssue: '발행할 수 있어요',
    overTransfer: '잔액을 넘었어요',
    overIssue: '발행 여력을 넘었어요',
    nextTransfer: '보내기 확인',
    nextIssue: '발행 확인',
    clear: '전체삭제',
    backspace: '한 자 지우기',
  },

  confirm: {
    titleTransfer: '이렇게 보낼까요?',
    titleIssue: '이렇게 발행할까요?',
    holdTransfer: '꾹 눌러서 보내기',
    holdIssue: '꾹 눌러서 발행',
    sending: '보내는 중',
    issuing: '발행하는 중',
    balanceNow: '지금 잔액',
    balanceAfter: '보낸 뒤 남는 잔액',
    supplyNow: '지금 총 유통량',
    supplyAfter: '발행 뒤 총 유통량',
    supplyChange: '유통량 변화',
  },

  result: {
    titleTransfer: '보냈어요',
    titleIssue: '발행했어요',
    remaining: '남은 잔액',
    supply: '총 유통량',
  },

  failure: {
    heading: '보내지 못했어요',
    headingIssue: '발행하지 못했어요',
    /** 결과를 아는 실패에 붙는 딱지 */
    whereLabel: '포인트는 여기 있어요',
    /** 결과를 모르는 실패에 붙는 딱지. 단정하지 않는다는 뜻이다 */
    unknownLabel: '지금 확실한 것',
    draftLabel: '보내려던 것',
    editAmount: '금액 고치기',
    repick: '받는 사람 다시 고르기',

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
    filterAll: '전체',
  },

  settings: {
    title: '설정',
    colorMode: '화면 밝기',
    colorModeSystem: '자동',
    colorModeLight: '밝게',
    colorModeDark: '어둡게',
    devPanel: '개발자 패널',
  },

  issuer: {
    title: '발행 관리',
    supply: '총 유통량',
    cap: '발행 상한',
    headroom: '남은 여력',
    issue: '발행하기',
  },

  dev: {
    title: '개발자 패널',
    latency: '응답 지연',
    latencyInstant: '즉시',
    latencyNormal: '보통',
    latencySlow: '느림',
    forceFailure: '다음 요청을 실패시키기',
    failureRate: '무작위 실패율',
    reset: '처음 상태로',
    clear: '해제',
  },
} as const

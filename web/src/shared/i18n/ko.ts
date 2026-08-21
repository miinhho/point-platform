
// UI 문체는 해요체. 규칙은 copy.test.ts 가 지킨다.
export const ko = {
  common: {
    loading: '불러오는 중',
    retry: '다시 시도',
    /** 조회 실패. 빈 목록과 절대 같은 화면이 되면 안 된다 — CLAUDE.md */
    loadFailed: '불러오지 못했어요',
    /** 조회는 돈을 움직이지 않는다. 실패 문구는 늘 그것을 말한다 */
    loadFailedWhere: '아무것도 바뀌지 않았어요',
    back: '뒤로',
    ok: '확인',
    /** 이름이 겹칠 때만 붙는 부제 — 홈 카드와 보내기 플로우가 같이 쓴다 */
    issuedBy: '{{name}} 발행',
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
    loadFailed: '내역을 불러오지 못했어요',
    detailFailed: '이 내역을 불러오지 못했어요',
    detailAbsent: '이 기록은 볼 수 없어요',
    /** 발행 줄. 상대 자리를 비우고 무엇을 발행했는지만 말한다 */
    issuedTo: '{{name}} 발행',
    detailTitleTransfer: '이체 내역',
    detailTitleIssue: '발행 내역',
    at: '보낸 시각',
    issuedAt: '발행한 시각',
    /** 그때의 값이다. 지금 값이 아니다 — 계약: docs/API.md */
    supplyAfter: '발행 뒤 총 유통량',
    capAt: '그때의 발행 상한',
    /** 상한 변경 줄. 이체 줄의 위계를 빌려 쓰지 않는다 — 여정 8 */
    capRaised: '{{name}} 발행 상한이 올랐어요',
    capLowered: '{{name}} 발행 상한이 내렸어요',
    capFromTo: '{{from}} → {{to}}',
  },

  create: {
    title: '포인트 만들기',
    entry: '포인트 만들기',
    name: '이름',
    namePlaceholder: '동네빵집',
    emoji: '표식',
    emojiHint: '좁은 자리에서 이름 대신 보여요. 겹쳐도 괜찮아요',
    description: '소개',
    descriptionPlaceholder: '골목 끝 빵집이에요. 빵 사면 쌓여요',
    descriptionHint: '안 적어도 만들어져요. 나중에 바꿀 수 있어요',
    accent: '색',
    /** 기본값을 두지 않는다. 바꿀 수 없는 값에 기본값을 두면 고른 적 없는 상태가 남는다 */
    visibility: '누가 쓸 수 있나요?',
    visibilityPublic: '공개',
    visibilityPublicNote: '누구나 받고 보낼 수 있어요',
    visibilityPrivate: '비공개',
    visibilityPrivateNote: '초대받은 사람끼리만 주고받아요',
    visibilityFixed: '만든 뒤에는 바꿀 수 없어요',
    cap: '발행 상한',
    capHint: '{{amount}}까지 발행할 수 있어요',
    preview: '이렇게 보여요',
    /** 만들기 전에 말한다 — docs/JOURNEY.md 여정 9 */
    irreversible: '만든 뒤에는 지울 수 없어요',
    hold: '꾹 눌러서 만들기',
    made: '만들었어요',
    madeWhere: '홈에서 볼 수 있어요. 아직 아무것도 발행하지 않았어요',
    accents: {
      blue: '파랑',
      green: '초록',
      purple: '보라',
      orange: '주황',
      pink: '분홍',
      teal: '청록',
      amber: '호박',
      rose: '장미',
      indigo: '남색',
      lime: '연두',
    },
  },

  cap: {
    title: '발행 상한 바꾸기',
    entry: '상한 바꾸기',
    next: '새 상한',
    floor: '{{amount}}보다 낮출 수 없어요',
    holdersLabel: '가진 사람에게는',
    /** 상한은 「여기까지만 희석된다」는 약속이다 — 여정 9 */
    holdersRaised: '{{amount}}까지 늘어날 수 있게 돼요',
    holdersLowered: '{{amount}}까지만 늘어나요',
    /** 「취소」라는 말을 쓰지 않는다. 낮추는 것은 다시 바꾸는 것이지 취소가 아니다 — 여정 9 */
    irreversible: '낮춰도 이미 발행된 것은 돌아오지 않아요',
    hold: '꾹 눌러서 바꾸기',
    /** 바뀐 값은 같은 페이지의 표에 나온다. 화면을 못 보는 사람에게는 그것이 닿지 않는다 */
    changed: '상한을 바꿨어요',
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

  bank: {
    title: '은행',
    loadFailed: '이 은행을 불러오지 못했어요',
    /** 못 불러온 것이 아니라 답이다. 다시 하는 길을 주지 않는다 — 규칙: CLAUDE.md */
    absent: '이 은행은 볼 수 없어요',
    membersFailed: '회원을 불러오지 못했어요',
    /** 앱이 보증한 글이 아니라는 것을 라벨이 말한다 — 여정 10 */
    descriptionLabel: '발행자가 쓴 소개',
    /** 카드 옆 진입점. 발행자가 아닌 사람에게도 보인다 — 여정 10 */
    entry: '자세히',
    /** 카드가 여럿이라 보이는 글자만으로는 어느 포인트인지 알 수 없다 */
    entryFor: '{{name}} 자세히',
    /** 흉내낼 수 없는 유일한 것 — 이름·기호·색은 전부 고르는 것이다 */
    issuer: '만든 사람',
    created: '만든 날',
    supply: '총 유통량',
    cap: '발행 상한',
    headroom: '남은 여력',
    issue: '발행하기',
    myBalance: '내 잔액',
    send: '보내기',
    /** 가입은 되돌릴 수 있다. 무게를 아무 데나 두면 무게가 뜻을 잃는다 — 여정 10 */
    join: '들어가기',
    joined: '들어왔어요',
    members: '회원',
    memberCountValue: '{{count}}명',
    invite: '초대하기',
    inviteTitle: '누구를 초대할까요?',
    invited: '초대했어요',
    membersEntry: '회원 보기',
    issuerBadge: '은행장',
    remove: '내보내기',
    leave: '나가기',
    /** 「간 건 간 거다」 — 잔액을 지우거나 옮기지 않는다. 계약: docs/API.md */
    leaveKeeps: '나가도 잔액은 그대로 남지만 쓸 수 없어요',
    /** 나온 사람에게 이 페이지는 물으러 갈 곳이다 — 겁주는 자리가 아니다 */
    outsider: '이 은행의 회원이 아니에요',
    outsiderWhy: '그래서 이 잔액을 지금 보낼 수 없어요',
    outsiderKeeps: '없어진 것은 아니에요. 다시 초대받으면 그대로 써요',
  },

  home: {
    title: '내 포인트',
    /** 초대는 홈에서 열고 판단은 은행 페이지에서 한다 — 여정 10 */
    invites: '받은 초대',
    invitedBy: '{{handle}} 님의 초대예요',
    empty: '아직 받은 포인트가 없어요',
    /** 발행 권한이 있는 포인트에만 붙는다 */
    issuerBadge: '내가 발행',
    zeroBalance: '보낼 잔액이 없어요',
    /** 나간 은행의 잔액. 지우지도 옮기지도 않고 쓸 수 없는 채로 남는다 — 계약: docs/API.md */
    locked: '지금은 보낼 수 없어요',
    /** 발행할 수 있는 사람에게는 다음 할 일이 기다리기가 아니라 발행이다 */
    zeroBalanceIssuer: '발행해서 채울 수 있어요',
    /** 세 번째 0 — 가진 적 없는 것도 가졌던 것도 아니고, 들어왔지만 아직 없는 것 */
    joinedNoBalance: '들어왔어요. 아직 받은 것이 없어요',
    /** 표시를 지우는 것은 실제로 그 포인트를 쓴 일뿐이다 — 여정 10 */
    neverSpent: '아직 써 보지 않은 포인트예요',
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
    loadFailed: '받는 사람을 불러오지 못했어요',
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
    /** 되돌릴 수 없는 것 직전이 마지막 방어선이다 — 여정 10 */
    firstUse: '이 포인트를 처음 써요',
    firstUseIssuer: '만든 사람',
    supplyNow: '지금 총 유통량',
    /*
     * 예상과 사실을 같게 보이지 않는다 — 계약: docs/API.md.
     * 「지금」과 「상한」은 사실이라 표시가 없고, 발행 뒤 값과 변화율만 예상이다.
     * 그래서 이 화면 안에서 둘이 갈린다.
     */
    supplyAfter: '발행 뒤 총 유통량 (예상)',
    supplyChange: '유통량 변화 (예상)',
    supplyFirst: '첫 발행',
    cap: '발행 상한',
    /** 화면은 바뀌지 않는다. 진행 중이라는 사실은 소리로만 전한다 — docs/JOURNEY.md 여정 5 */
    sendingTransfer: '보내고 있어요',
    sendingIssue: '발행하고 있어요',
  },

  result: {
    titleTransfer: '보냈어요',
    titleIssue: '발행했어요',
    remaining: '남은 잔액',
    /** 잔액 0 과 구별한다. 전액을 보내면 목록에서 빠지므로 둘이 겹치기 쉽다 */
    balanceUnknown: '잔액을 못 불러왔어요',
    supply: '총 유통량',
    /** 상태 변화를 소리로도 알린다 */
    announceTransfer: '보냈어요. 남은 잔액 {{balance}}',
  },

  failure: {
    heading: '보내지 못했어요',
    headingIssue: '발행하지 못했어요',
    whereLabel: '포인트는 여기 있어요',
    /** 결과를 모를 때. 단정하지 않는다는 뜻이다 */
    unknownLabel: '지금 확실한 것',
    draftLabel: '보내려던 것',
    draftLabelIssue: '발행하려던 것',
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
    /** 받는 쪽의 코드와 가려야 할 것이 다르다 — 보내는 사람은 자기가 나온 것을 이미 안다 */
    NOT_MEMBER: {
      title: '이 은행의 회원이 아니에요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    /** 은행 화면 안에서 판정으로만 쓰인다. 실패 화면에 오지 않는다 */
    NOT_A_PRIVATE_BANK: {
      title: '공개 은행에는 회원이 없어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    /** 클라이언트와 서버의 판이 어긋난 것이다. 사용자가 고칠 입력이 없다 */
    UNKNOWN_ENDPOINT: {
      title: '앱을 업데이트해야 해요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    /** 초대 화면이 후보에서 빼므로 겹쳐 들어온 경우에만 난다 */
    ALREADY_MEMBER: {
      title: '이미 이 은행의 회원이에요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    /** 남의 초대와 같은 답이다. 누가 초대됐는지 새면 안 된다 */
    INVITE_NOT_FOUND: {
      title: '초대를 찾을 수 없어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
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
    /** 은행 화면 안에서 그 자리에 뜬다. where 는 키 구조를 맞추려고 둔다 */
    ISSUER_CANNOT_LEAVE: {
      title: '은행장은 나갈 수 없어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    /** 상한 변경 화면 안에서 그 자리에 뜬다. where 는 키 구조를 맞추려고 둔다 */
    CAP_BELOW_ISSUED: {
      title: '이미 발행한 양보다 낮아요',
      whereTransfer: '상한은 그대로예요',
      whereIssue: '상한은 그대로예요',
    },
    /** 화면에서는 도달하지 않는다. 방어적으로 그리는 자리를 위해 둔다 */
    MALFORMED_REQUEST: {
      title: '요청을 보내지 못했어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    TRANSFER_NOT_FOUND: {
      title: '그 내역을 찾을 수 없어요',
      whereTransfer: '아무것도 나가지 않았어요',
      whereIssue: '발행되지 않았어요',
    },
    ISSUE_NOT_FOUND: {
      title: '그 발행을 찾을 수 없어요',
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

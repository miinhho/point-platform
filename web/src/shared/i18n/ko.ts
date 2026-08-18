
// UI 문체는 해요체. 규칙은 copy.test.ts 가 지킨다.
export const ko = {
  common: {
    loading: '불러오는 중',
    retry: '다시 시도',
  },

  home: {
    title: '내 포인트',
    empty: '아직 받은 포인트가 없어요',
    /** 발행 권한이 있는 포인트에만 붙는다 */
    issuerBadge: '내가 발행',
    /** 이름이 겹칠 때만 붙는 부제 */
    issuedBy: '{{name}} 발행',
    zeroBalance: '보낼 잔액이 없어요',
    loadFailed: '지갑을 불러오지 못했어요',
  },

  failure: {
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
} as const

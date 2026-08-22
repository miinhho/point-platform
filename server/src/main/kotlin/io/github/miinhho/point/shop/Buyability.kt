package io.github.miinhho.point.shop

/**
 * 지금 이 사람이 이 품목을 살 수 있는가. 못 사면 왜인지까지 서버가 싣는다 —
 * 없으면 화면이 여섯을 조합해 규칙을 다시 만들고, **버튼을 그려 놓고 쓰기가 거절하는
 * 화면**이 된다 (docs/API.md 「살 수 있는가는 서버가 답한다」).
 */
enum class Buyability(val wire: String) {
    OK("ok"),

    /** 비공개 은행의 비회원. 잔액이 남은 채 나간 사람이 여기 온다. */
    NOT_MEMBER("notMember"),

    /** 은행장은 자기 품목을 사지 않는다 — 순효과 0 인 줄이 된다. */
    ISSUER("issuer"),
    UNLISTED("unlisted"),
    SOLD_OUT("soldOut"),
    LIMIT_REACHED("limitReached"),

    /** 한 개 값도 안 된다. */
    INSUFFICIENT_BALANCE("insufficientBalance"),
}

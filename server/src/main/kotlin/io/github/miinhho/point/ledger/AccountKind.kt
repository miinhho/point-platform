package io.github.miinhho.point.ledger

/** 부호 규칙을 코드에 박지 않고 계정 유형이 정한다. 근거: docs/LEDGER.md 「계정」. */
enum class AccountKind {
    /** 은행이 보유자에게 진 빚. 음수가 될 수 없다. */
    HOLDER,

    /** 그 빚의 반대편. 포인트마다 하나뿐이고 음수가 정상이다. */
    ISSUANCE,
}

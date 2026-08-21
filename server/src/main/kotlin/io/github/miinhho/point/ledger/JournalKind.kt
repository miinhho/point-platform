package io.github.miinhho.point.ledger

/** 사건의 종류. 전기 모양에서 유추하지 않는다 — 내역을 그리는 쪽이 원장 규칙을 알게 된다. */
enum class JournalKind(val posts: Boolean) {
    ISSUE(posts = true),
    TRANSFER(posts = true),

    /** 전기가 없는 사건. 잔액은 안 움직이지만 약속이 바뀐 것은 사건이다. */
    CAP_CHANGE(posts = false),
}

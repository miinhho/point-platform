package io.github.miinhho.point.pointtype

// 공개와 비공개가 가르는 것은 범위다 — 비공개에서는 회원끼리만 주고받는다.
// 근거: docs/JOURNEY.md
enum class PointVisibility {
    PUBLIC, PRIVATE,
}

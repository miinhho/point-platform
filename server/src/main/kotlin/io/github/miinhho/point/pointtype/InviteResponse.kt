package io.github.miinhho.point.pointtype

import java.time.Instant

// 받는 사람이 판단할 것이 여기 다 있다 — 은행을 따로 물으러 가지 않는다.
data class InviteResponse(
    val id: String,
    val pointType: PointTypeResponse,
    val byId: String,
    val byHandle: String,
    val createdAt: Instant,
)

data class InviteRequest(val userId: String? = null)

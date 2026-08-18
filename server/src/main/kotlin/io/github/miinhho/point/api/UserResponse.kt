package io.github.miinhho.point.api

import io.github.miinhho.point.domain.user.User

data class UserResponse(
    val id: String,
    val name: String,
    val handle: String,
    /** 원장 전체에서 이 이름을 쓰는 사용자가 둘 이상인가. 보는 사람에 따라 달라지지 않는다. */
    val nameIsShared: Boolean,
)

// sharedNames 를 인자로 강제한다 — 기본값을 주면 사용자를 내보내는 경로가 하나 늘 때
// 조용히 빠지고, 그러면 겹치는데도 false 가 나가 방어가 꺼진다.
fun User.toResponse(sharedNames: Set<String>) = UserResponse(
    id = publicId.toString(),
    name = name,
    handle = handle,
    nameIsShared = name in sharedNames,
)

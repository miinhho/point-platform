package io.github.miinhho.point.pointtype

/**
 * 그 줄이 어느 포인트인가. 내역 세 갈래와 단건 조회가 함께 싣는다.
 *
 * 지갑에서 찾게 두면 모수가 달라 빈 줄이 생긴다 — 받은 것을 전액 보내면 그 순간 지갑에서
 * 빠지는데 방금 만든 이체 줄은 남는다. 일어난 일이지 지금 가진 것이 아니다.
 */
data class PointMarkResponse(
    val name: String,
    val emoji: String,
    val accent: String,
    val nameIsShared: Boolean,
    val issuerHandle: String,
)

fun PointType.toMark(sharedNames: Set<String>) = PointMarkResponse(
    name = name,
    emoji = emoji,
    accent = accent.name.lowercase(),
    nameIsShared = name in sharedNames,
    issuerHandle = issuer.handle,
)

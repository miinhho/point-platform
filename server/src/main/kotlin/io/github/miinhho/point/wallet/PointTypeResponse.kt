package io.github.miinhho.point.wallet

import io.github.miinhho.point.domain.pointtype.PointType

data class PointTypeResponse(
    val id: String,
    val name: String,
    val symbol: String,
    val issuerId: String,
    val issuerName: String,
    val canIssue: Boolean,
    val issuableHeadroom: Long,
    val accent: String,
    val totalIssued: Long,
    val issueCap: Long,
    /** 원장 전체에서 이 이름을 쓰는 포인트가 둘 이상인가. 보는 사람에 따라 달라지지 않는다. */
    val nameIsShared: Boolean,
)

// canIssue·issuableHeadroom 은 보는 사람에 따라 다르다 — 서버가 판정해 실어 준다.
// nameIsShared 는 다르다. 겹침은 원장의 성질이라 누가 보든 같다.
fun PointType.toResponse(viewerId: Long, sharedNames: Set<String>) = PointTypeResponse(
    id = publicId.toString(),
    name = name,
    symbol = symbol,
    issuerId = issuer.publicId.toString(),
    issuerName = issuer.name,
    canIssue = issuer.id == viewerId,
    issuableHeadroom = maxOf(0, issueCap - totalIssued),
    accent = accent.name.lowercase(),
    totalIssued = totalIssued,
    issueCap = issueCap,
    nameIsShared = name in sharedNames,
)

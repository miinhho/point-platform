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
)

// canIssue·issuableHeadroom 은 보는 사람에 따라 다르다 — 서버가 판정해 실어 준다.
fun PointType.toResponse(viewerId: Long) = PointTypeResponse(
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
)

package io.github.miinhho.point.pointtype

import io.github.miinhho.point.ledger.Supply
import java.time.Instant

data class PointTypeResponse(
    val id: String,
    val name: String,
    /** 알아보는 표식. 유일하지 않다 — 이모지가 같아도 다른 은행일 수 있다. */
    val emoji: String,
    /** 발행자가 적은 소개. 앱이 보증하는 글이 아니다. */
    val description: String?,
    val issuerId: String,
    val issuerName: String,
    /** 발행자의 핸들. 유일하다 — issuerName 은 흉내낼 수 있다. */
    val issuerHandle: String,
    val canIssue: Boolean,
    val issuableHeadroom: Long,
    val accent: String,
    val totalIssued: Long,
    val issueCap: Long,
    /** 원장 전체에서 이 이름을 쓰는 포인트가 둘 이상인가. 보는 사람에 따라 달라지지 않는다. */
    val nameIsShared: Boolean,
    /** 만들어진 시각. 오래된 것은 흉내낼 수 없다. */
    val createdAt: Instant,
    /** `"public"` 이면 회원 개념이 없고 누구나 주고받는다. 창설 뒤에는 바뀌지 않는다. */
    val visibility: String,
    /** 비공개 은행의 회원 수. 공개 은행에는 회원이 없으므로 `null` 이다. */
    val memberCount: Long?,
    /** 보는 사람이 `"member"` · `"invited"` · `"outsider"` 중 무엇인가. 공개면 `null`. */
    val membership: String?,
)

// canIssue·issuableHeadroom 은 보는 사람에 따라 다르다 — 서버가 판정해 실어 준다.
// nameIsShared 는 다르다. 겹침은 원장의 성질이라 누가 보든 같다.
// 인자를 강제한다 — 기본값을 주면 내보내는 경로가 하나 늘 때 조용히 빠진다.
fun PointType.toResponse(
    viewerId: Long,
    sharedNames: Set<String>,
    memberCount: Long?,
    membership: String?,
    supply: Supply,
) = PointTypeResponse(
    id = publicId.toString(),
    name = name,
    emoji = emoji,
    description = description,
    issuerId = issuer.publicId.toString(),
    issuerName = issuer.name,
    issuerHandle = issuer.handle,
    canIssue = issuer.id == viewerId,
    issuableHeadroom = supply.headroom,
    accent = accent.name.lowercase(),
    totalIssued = supply.issued,
    issueCap = supply.cap,
    nameIsShared = name in sharedNames,
    createdAt = createdAt,
    visibility = visibility.name.lowercase(),
    memberCount = memberCount,
    membership = membership,
)

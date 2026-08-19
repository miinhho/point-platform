package io.github.miinhho.point.pointtype

import java.math.BigDecimal

// issueCap 을 Long 으로 받으면 Jackson 이 소수점을 조용히 자른다 — BigDecimal 로 받아 직접 본다.
// issuerId 를 받지 않는다. 만든 사람이 발행자다 (docs/API.md 「엔드포인트」).
data class CreatePointTypeRequest(
    val name: String? = null,
    val emoji: String? = null,
    val description: String? = null,
    val accent: String? = null,
    val issueCap: BigDecimal? = null,
    // 기본값을 두지 않는다 — 「기본이 공개」는 만든 사람이 모르는 사이에 열리는 일이다.
    val visibility: String? = null,
)

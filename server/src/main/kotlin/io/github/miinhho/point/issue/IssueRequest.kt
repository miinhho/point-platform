package io.github.miinhho.point.issue

import java.math.BigDecimal

// amount 를 Long 으로 받으면 Jackson 이 소수점을 조용히 잘라낸다(100.5 → 100).
// toId 를 받는 자리가 아니지만 필드는 둔다 — 실려 오면 거절해야 알 수 있다.
data class IssueRequest(
    val pointTypeId: String? = null,
    val amount: BigDecimal? = null,
    val toId: String? = null,
)

package io.github.miinhho.point.pointtype

import java.math.BigDecimal

// Long 으로 받으면 Jackson 이 소수점을 조용히 자른다.
data class ChangeCapRequest(val issueCap: BigDecimal? = null)

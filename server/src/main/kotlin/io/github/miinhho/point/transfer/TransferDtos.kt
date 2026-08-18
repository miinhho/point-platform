package io.github.miinhho.point.transfer

import java.math.BigDecimal
import java.time.Instant

// amount 를 Long 으로 받으면 Jackson 이 소수점을 조용히 잘라낸다(100.5 → 100).
// BigDecimal 로 받아 정수 여부를 직접 검증한다 — 근거: docs/API.md.
// toId 는 이체 본문에만 쓰인다. 발행 본문에 실려 오면 malformed 로 거절한다.
data class TransferRequest(val pointTypeId: String? = null, val toId: String? = null, val amount: BigDecimal? = null)

data class TransferResponse(
    val id: String,
    val idempotencyKey: String,
    val kind: String,
    val pointTypeId: String,
    val fromId: String?,
    val toId: String,
    val amount: Long,
    val createdAt: Instant,
    val confirmedAt: Instant,
)

fun Transfer.toResponse() = TransferResponse(
    id = publicId.toString(),
    idempotencyKey = idempotencyKey,
    kind = kind.name.lowercase(),
    pointTypeId = pointType.publicId.toString(),
    fromId = from?.publicId?.toString(),
    toId = to.publicId.toString(),
    amount = amount,
    createdAt = createdAt,
    confirmedAt = confirmedAt,
)

package io.github.miinhho.point.transfer

import java.math.BigDecimal
import java.time.Instant

// amount 를 Long 으로 받으면 Jackson 이 소수점을 조용히 잘라낸다(100.5 → 100).
// BigDecimal 로 받아 정수 여부를 직접 검증한다 — 근거: docs/API.md.
// toId 는 이체 본문에만 쓰인다. 발행 본문에 실려 오면 malformed 로 거절한다.
data class TransferRequest(val pointTypeId: String? = null, val toId: String? = null, val amount: BigDecimal? = null)

/** 상대. 누구인지는 원장의 성질이라 클라이언트가 목록에서 맞추면 목록에 없는 순간 틀린다. */
data class CounterpartyResponse(val name: String, val handle: String, val nameIsShared: Boolean)

data class TransferResponse(
    val id: String,
    val idempotencyKey: String,
    val pointTypeId: String,
    val fromId: String,
    val toId: String,
    /** 보는 사람 기준이다 — 보낸 쪽에는 받은 사람이, 받은 쪽에는 보낸 사람이 실린다. */
    val counterparty: CounterpartyResponse,
    val amount: Long,
    val createdAt: Instant,
    val confirmedAt: Instant,
)

fun Transfer.toResponse(viewerId: Long, sharedNames: Set<String>) = TransferResponse(
    id = publicId.toString(),
    idempotencyKey = idempotencyKey,
    pointTypeId = pointType.publicId.toString(),
    fromId = from.publicId.toString(),
    toId = to.publicId.toString(),
    counterparty = (if (from.id == viewerId) to else from)
        .let { CounterpartyResponse(it.name, it.handle, it.name in sharedNames) },
    amount = amount,
    createdAt = createdAt,
    confirmedAt = confirmedAt,
)

package io.github.miinhho.point.transfer

import io.github.miinhho.point.pointtype.PointMarkResponse
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.user.User
import io.github.miinhho.point.pointtype.toMark
import java.math.BigDecimal
import java.time.Instant

// amount 를 Long 으로 받으면 Jackson 이 소수점을 조용히 잘라낸다(100.5 → 100).
// BigDecimal 로 받아 정수 여부를 직접 검증한다 — 근거: docs/API.md.
// toId 는 이체 본문에만 쓰인다. 발행 본문에 실려 오면 malformed 로 거절한다.
data class TransferRequest(val pointTypeId: String? = null, val toId: String? = null, val amount: BigDecimal? = null)

/** 상대. 누구인지는 원장의 성질이라 클라이언트가 목록에서 맞추면 목록에 없는 순간 틀린다. */
data class CounterpartyResponse(val name: String, val handle: String, val nameIsShared: Boolean)

data class TransferResponse(
    /** 사건의 id 다. 부속 기록이 자기 id 를 따로 갖지 않는다 — 한 사건에 바깥 id 도 하나다. */
    val id: String,
    val idempotencyKey: String,
    val pointTypeId: String,
    /** 지갑을 뒤지는 길을 남겨 두면 안 된다 — 모수가 달라 빈 줄이 생긴다. */
    val point: PointMarkResponse,
    /** 보는 사람 기준이다 — 보낸 쪽에는 받은 사람이, 받은 쪽에는 보낸 사람이 실린다. */
    val counterparty: CounterpartyResponse,
    /** 보는 사람이 보낸 것인가. 화면이 id 를 맞춰 보고 방향을 정하지 않는다. */
    val outgoing: Boolean,
    val amount: Long,
    /** 일어난 때. 만든 때와 확정된 때가 갈리지 않는다 — 저장된 이체는 언제나 확정이다. */
    val occurredAt: Instant,
)

/**
 * 보낸 사람과 포인트는 사건이 id 로만 아는 것이라 **호출부가 모아서 넘긴다** — 줄마다
 * 프록시를 열면 내역 한 화면이 조회 서른 번이다.
 */
fun Transfer.toResponse(
    viewerId: Long,
    from: User,
    point: PointType,
    sharedNames: Set<String>,
    sharedPointNames: Set<String>,
): TransferResponse {
    val outgoing = from.id == viewerId
    return TransferResponse(
        id = journalEntry.publicId.toString(),
        idempotencyKey = journalEntry.idempotencyKey,
        pointTypeId = point.publicId.toString(),
        point = point.toMark(sharedPointNames),
        counterparty = (if (outgoing) to else from)
            .let { CounterpartyResponse(it.name, it.handle, it.name in sharedNames) },
        outgoing = outgoing,
        amount = amount,
        occurredAt = journalEntry.occurredAt,
    )
}

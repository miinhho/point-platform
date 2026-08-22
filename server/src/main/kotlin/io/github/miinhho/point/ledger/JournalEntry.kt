package io.github.miinhho.point.ledger

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * 사건 하나. 추가만 된다 — 정정도 새 분개다 (docs/LEDGER.md).
 *
 * **누구의 것인지·어느 포인트인지를 id 로만 안다.** 원장은 사용자도 포인트도 타입으로
 * 모른다 — 알면 원장을 고치려고 그것들을 함께 열어야 하고, 사건마다 프록시가 열려
 * 내역 한 화면이 조회 서른 번이 된다.
 */
@Entity
@Table(name = "journal_entries")
class JournalEntry(
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16, updatable = false)
    val kind: JournalKind,

    @Column(name = "requester_id", nullable = false, updatable = false)
    val requesterId: Long,

    /** 멱등성 키는 사건이 갖는다. 요청자와 함께 유일하다 — 남이 내 키를 선점하지 못한다. */
    @Column(name = "idempotency_key", nullable = false, length = 36, updatable = false)
    val idempotencyKey: String,

    @Column(name = "point_type_id", nullable = false, updatable = false)
    val pointTypeId: Long,

    // datetime(6) 은 마이크로초다. 나노초를 두면 만든 직후와 다시 읽은 값이 달라진다.
    @Column(name = "occurred_at", nullable = false, updatable = false)
    val occurredAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    override fun equals(other: Any?) = other is JournalEntry && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

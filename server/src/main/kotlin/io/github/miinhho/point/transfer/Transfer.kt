package io.github.miinhho.point.transfer

import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

// 근거: docs/JOURNEY.md 「버린 것」
@Entity
@Table(
    name = "transfers",
    // pointTypeId 는 GET /api/transfers 에서 선택 조건이라 인덱스 중간에 두면
    // 조건 없는 조회의 정렬(created_at)이 filesort 로 떨어진다.
    indexes = [
        Index(name = "ix_transfers_from", columnList = "from_id,created_at"),
        Index(name = "ix_transfers_to", columnList = "to_id,created_at"),
    ],
)
class Transfer(
    @Column(name = "idempotency_key", nullable = false, length = 36)
    val idempotencyKey: String,

    // 멱등성 키의 임자. 이체면 보낸 쪽, 발행이면 발행자다 — 발행에는 from 이 없다.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    val requester: User,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val kind: TransferKind,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "point_type_id", nullable = false)
    val pointType: PointType,

    // 발행은 무에서 만든다 — from 이 null 인 것이 곧 발행이다
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_id")
    val from: User?,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_id", nullable = false)
    val to: User,

    @Column(nullable = false)
    val amount: Long,

    @Column(name = "confirmed_at", nullable = false)
    val confirmedAt: Instant = Instant.now(),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = confirmedAt

    override fun equals(other: Any?) = other is Transfer && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

package io.github.miinhho.point.transfer

import io.github.miinhho.point.ledger.JournalEntry
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
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
    /** 이체는 이 사건의 부속 기록이다. 멱등성 키도 시각도 사건이 갖는다. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_entry_id", nullable = false, updatable = false)
    val journalEntry: JournalEntry,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "point_type_id", nullable = false)
    val pointType: PointType,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_id", nullable = false)
    val from: User,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_id", nullable = false)
    val to: User,

    @Column(nullable = false)
    val amount: Long,

    @Column(name = "confirmed_at", nullable = false)
    val confirmedAt: Instant = journalEntry.occurredAt,
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

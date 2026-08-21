package io.github.miinhho.point.issue

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

// 대상이 없다. 발행자가 곧 받는 사람이라 칸이 하나다 (docs/API.md 「발행은 이체가 아니다」).
@Entity
@Table(
    name = "issues",
    indexes = [
        Index(name = "ix_issues_issuer", columnList = "issuer_id,confirmed_at"),
        Index(name = "ix_issues_point_type", columnList = "point_type_id,confirmed_at"),
    ],
)
class Issue(
    /** 발행은 이 사건의 부속 기록이다. 멱등성 키도 시각도 사건이 갖는다. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_entry_id", nullable = false, updatable = false)
    val journalEntry: JournalEntry,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issuer_id", nullable = false)
    val issuer: User,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "point_type_id", nullable = false)
    val pointType: PointType,

    @Column(nullable = false)
    val amount: Long,

    // 일어난 일은 일어난 때의 값을 갖는다 — 지금 값에서 거꾸로 계산할 수 없다.
    @Column(name = "total_issued_after", nullable = false)
    val totalIssuedAfter: Long,

    @Column(name = "issue_cap_at", nullable = false)
    val issueCapAt: Long,

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

    override fun equals(other: Any?) = other is Issue && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

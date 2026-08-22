package io.github.miinhho.point.issue

import io.github.miinhho.point.ledger.JournalEntry
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.util.UUID

/**
 * 발행은 사건의 부속 기록이다 — 포인트도 발행자도 시각도 [JournalEntry] 의 것이다.
 *
 * 대상이 없다. 발행자가 곧 받는 사람이라 칸이 하나다 (docs/API.md 「발행은 이체가 아니다」).
 * 여기 남는 둘은 사건이 모르는 것이다 — **일어난 때의 값**이라 지금 값에서 거꾸로 계산할 수 없다.
 */
@Entity
@Table(name = "issues")
class Issue(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_entry_id", nullable = false, updatable = false)
    val journalEntry: JournalEntry,

    @Column(nullable = false)
    val amount: Long,

    @Column(name = "total_issued_after", nullable = false)
    val totalIssuedAfter: Long,

    @Column(name = "issue_cap_at", nullable = false)
    val issueCapAt: Long,
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

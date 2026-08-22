package io.github.miinhho.point.pointtype

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
 * 상한 변경은 전기 없는 사건의 부속 기록이다 — 포인트도 바꾼 사람도 시각도 [JournalEntry] 의
 * 것이고, 여기 남는 둘은 그 사건이 무엇을 무엇으로 바꿨는지다.
 *
 * 되돌릴 수 없고 이력에 남는다. 낮추는 것도 취소가 아니다 — 올려 둔 동안 발행된 것은
 * 이미 남의 지갑에 있다 (docs/JOURNEY.md 여정 9).
 */
@Entity
@Table(name = "cap_changes")
class CapChange(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_entry_id", nullable = false, updatable = false)
    val journalEntry: JournalEntry,

    @Column(name = "previous_cap", nullable = false)
    val previousCap: Long,

    @Column(name = "issue_cap", nullable = false)
    val issueCap: Long,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    override fun equals(other: Any?) = other is CapChange && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

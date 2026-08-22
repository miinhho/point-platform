package io.github.miinhho.point.transfer

import io.github.miinhho.point.ledger.JournalEntry
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

/**
 * 이체는 사건의 부속 기록이다 — **사건이 아는 것을 다시 갖지 않는다.** 포인트도 보낸 사람도
 * 시각도 멱등성 키도 [JournalEntry] 의 것이고, 여기 남는 것은 사건이 모르는 것뿐이다.
 *
 * 받는 사람은 사건이 모른다. 사건의 요청자는 보낸 사람이라 대상은 여기 있어야 한다.
 * 근거: docs/JOURNEY.md 「버린 것」 — status 컬럼이 없다. 저장된 이체는 언제나 확정이다.
 */
@Entity
@Table(name = "transfers", indexes = [Index(name = "ix_transfers_to", columnList = "to_id")])
class Transfer(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_entry_id", nullable = false, updatable = false)
    val journalEntry: JournalEntry,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_id", nullable = false)
    val to: User,

    @Column(nullable = false)
    val amount: Long,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set


    override fun equals(other: Any?) = other is Transfer && id != null && id == other.id
    override fun hashCode() = id?.hashCode() ?: 0
}

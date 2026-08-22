package io.github.miinhho.point.ledger

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

/** 사건을 계정에 옮겨 적은 것. 사건당 둘 이상이고 합이 0 이다 (docs/LEDGER.md). */
@Entity
@Table(name = "postings")
class Posting(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_entry_id", nullable = false, updatable = false)
    val journalEntry: JournalEntry,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false, updatable = false)
    val account: Account,

    // 사건과 계정 양쪽의 복합 FK 가 이 한 값에 걸린다 — 전기가 사건의 포인트를 넘지 못한다.
    @Column(name = "point_type_id", nullable = false, updatable = false)
    val pointTypeId: Long,

    /** 부호 하나다. 보유자 +, 발행 − 가 아니라 그 계정에 더해지는 양이다. */
    @Column(nullable = false, updatable = false)
    val amount: Long,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    override fun equals(other: Any?) = other is Posting && id != null && id == other.id
    override fun hashCode() = id?.hashCode() ?: 0
}

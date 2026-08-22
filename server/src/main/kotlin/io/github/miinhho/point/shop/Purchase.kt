package io.github.miinhho.point.shop

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

/**
 * 구매는 사건의 부속 기록이다 — 산 사람도 시각도 포인트도 멱등성 키도 [JournalEntry] 의
 * 것이다. 여기 남는 것은 사건이 모르는 것뿐이다: 무엇을 몇 개 샀는가.
 *
 * 원장에서는 평범한 이체다(산 사람 −N · 은행장 +N). 유통량을 줄이지 않는다.
 */
@Entity
@Table(name = "purchases")
class Purchase(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_entry_id", nullable = false, updatable = false)
    val journalEntry: JournalEntry,

    @Column(name = "listing_id", nullable = false, updatable = false)
    val listingId: Long,

    /** 사건의 요청자와 같다. 뮤텍스 안의 1 인 한도 판정이 사건까지 조인하지 않게 하는 칸이다. */
    @Column(name = "buyer_id", nullable = false, updatable = false)
    val buyerId: Long,

    /** 그때의 이름. 이 줄이 품목보다 오래 살아야 하는 기록이라 스스로 들고 있는다. */
    @Column(name = "listing_name", nullable = false, length = 80, updatable = false)
    val listingName: String,

    @Column(nullable = false, updatable = false)
    val quantity: Int,

    /** `price × quantity`. 원장에 나간 액수다. */
    @Column(nullable = false, updatable = false)
    val amount: Long,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    override fun equals(other: Any?) = other is Purchase && id != null && id == other.id
    override fun hashCode() = id?.hashCode() ?: 0
}

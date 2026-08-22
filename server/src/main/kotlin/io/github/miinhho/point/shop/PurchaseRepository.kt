package io.github.miinhho.point.shop

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface PurchaseRepository : JpaRepository<Purchase, Long> {
    // 키는 「내가 같은 요청을 두 번 보냈나」에 답한다 — 임자와 함께 찾는다.
    @Query("select p from Purchase p where p.journalEntry.requesterId = :requesterId and p.journalEntry.idempotencyKey = :key")
    fun findByRequesterAndKey(requesterId: Long, key: String): Purchase?

    @Query("select p from Purchase p where p.journalEntry.id in :ids")
    fun byJournalEntryIds(ids: Collection<Long>): List<Purchase>

    /** 불변식이 본다 — 산 사람은 그 사건의 요청자다. 갈리면 남의 교환권이 내 목록에 온다. */
    @Query("select p.id, p.buyerId, p.journalEntry.requesterId from Purchase p")
    fun buyersAndRequesters(): List<Array<Any>>
}

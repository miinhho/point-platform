package io.github.miinhho.point.ledger

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface PostingRepository : JpaRepository<Posting, Long> {
    /** 사건별 전기 합. 0 이 아닌 사건이 있으면 원장이 틀린 것이다. */
    @Query("select p.journalEntry.id, sum(p.amount) from Posting p group by p.journalEntry.id having sum(p.amount) <> 0")
    fun entriesOutOfBalance(): List<Array<Any>>

    /** 포인트별 전기 합. 발행 계정이 그 빚의 반대편이므로 0 이어야 한다. */
    @Query("select p.pointTypeId, sum(p.amount) from Posting p group by p.pointTypeId having sum(p.amount) <> 0")
    fun pointTypesOutOfBalance(): List<Array<Any>>

    /** 계정별 전기 합. 잔액은 이것을 접어 둔 것이라 같아야 한다. */
    @Query("select p.account.id, sum(p.amount) from Posting p group by p.account.id")
    fun sumsByAccount(): List<Array<Any>>
}

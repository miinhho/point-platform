package io.github.miinhho.point.issue

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface IssueRepository : JpaRepository<Issue, Long> {
    fun findByPublicId(publicId: UUID): Issue?

    // 키는 「내가 같은 요청을 두 번 보냈나」에 답한다 — 임자와 함께 찾는다.
    // 키만으로 찾는 길을 두면 남의 것을 물을 수 있다.
    @Query("select i from Issue i where i.journalEntry.requester.id = :requesterId and i.journalEntry.idempotencyKey = :key")
    fun findByRequesterAndKey(requesterId: Long, key: String): Issue?

    @Query("select i from Issue i where i.journalEntry.id in :ids")
    fun byJournalEntryIds(ids: Collection<Long>): List<Issue>

    @Query(
        "select i from Issue i where i.issuer.id = :userId " +
            "and (:pointTypeId is null or i.pointType.id = :pointTypeId) order by i.confirmedAt desc",
    )
    fun history(userId: Long, pointTypeId: Long?, limit: Limit): List<Issue>
}

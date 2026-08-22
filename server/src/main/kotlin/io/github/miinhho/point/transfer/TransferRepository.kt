package io.github.miinhho.point.transfer

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface TransferRepository : JpaRepository<Transfer, Long> {
    // 키는 「내가 같은 요청을 두 번 보냈나」에 답한다 — 임자와 함께 찾는다.
    // 키만으로 찾는 길을 두면 남의 것을 물을 수 있다.
    @Query("select t from Transfer t where t.journalEntry.requesterId = :requesterId and t.journalEntry.idempotencyKey = :key")
    fun findByRequesterAndKey(requesterId: Long, key: String): Transfer?
    fun findByPublicId(publicId: UUID): Transfer?

    @Query("select t from Transfer t where t.journalEntry.id in :ids")
    fun byJournalEntryIds(ids: Collection<Long>): List<Transfer>

    /**
     * 내 이체. **내 전기가 있는 사건이 내 이체다** — 보낸 것도 받은 것도 전기가 하나씩 있다.
     *
     * `from = :me or to = :me` 로 물으면 두 표에 걸린 `or` 라 어느 인덱스도 못 고르고 전체를
     * 훑는다. 전기로 물으면 내 계정에서 출발해 좁혀진다.
     */
    @Query(
        "select t from Transfer t where exists " +
            "(select p.id from Posting p where p.journalEntry = t.journalEntry and p.account.userId = :userId) " +
            "and (:pointTypeId is null or t.journalEntry.pointTypeId = :pointTypeId) " +
            "order by t.journalEntry.occurredAt desc, t.journalEntry.id desc",
    )
    fun history(userId: Long, pointTypeId: Long?, limit: Limit): List<Transfer>

    // 포인트별 최근 대상 후보 — 서비스가 최신순으로 대상을 중복 제거해 limit 만큼 뽑는다.
    @Query(
        "select t from Transfer t where t.journalEntry.requesterId = :userId " +
            "and t.journalEntry.pointTypeId = :pointTypeId " +
            "order by t.journalEntry.occurredAt desc, t.journalEntry.id desc",
    )
    fun sentByPointType(userId: Long, pointTypeId: Long, limit: Limit): List<Transfer>

    // 발행은 세지 않는다 — from 이 없다. 「보낸 적 있는가」만 본다.
    @Query("select t.journalEntry.pointTypeId from Transfer t where t.journalEntry.requesterId = :userId")
    fun spentPointTypeIdsOf(userId: Long): Set<Long>
}

package io.github.miinhho.point.pointtype

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface CapChangeRepository : JpaRepository<CapChange, Long> {
    // 키는 요청자와 함께 찾는다 — 키만으로 찾는 길을 두면 남의 것을 물을 수 있다.
    @Query("select c from CapChange c where c.journalEntry.requesterId = :requesterId and c.journalEntry.idempotencyKey = :key")
    fun findByRequesterAndKey(requesterId: Long, key: String): CapChange?

    @Query("select c from CapChange c where c.journalEntry.id in :ids")
    fun byJournalEntryIds(ids: Collection<Long>): List<CapChange>

    // 그 포인트가 자기 지갑에 있는 사람과 발행자가 본다 — 발행자만 아는 변경은 약속이 아니다.
    // 지갑 판정은 호출부가 pointTypeIds 로 넘긴다.
    @Query(
        "select c from CapChange c where c.journalEntry.pointTypeId in :pointTypeIds " +
            "and (:pointTypeId is null or c.journalEntry.pointTypeId = :pointTypeId) " +
            "order by c.journalEntry.occurredAt desc, c.journalEntry.id desc",
    )
    fun visible(pointTypeIds: Collection<Long>, pointTypeId: Long?, limit: Limit): List<CapChange>
}

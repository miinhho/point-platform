package io.github.miinhho.point.ledger

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

// 키만으로 찾는 메서드를 두지 않는다 — 키는 요청자와 함께여야 남의 것을 묻지 못한다.
interface JournalEntryRepository : JpaRepository<JournalEntry, Long> {
    /**
     * 내역. 세 목록을 각각 limit 으로 잘라 합치면 **페이징할 때** 목록마다 시간축이 어긋나므로
     * 한 번에 자른다. 같은 마이크로초의 순서는 id 가 가른다.
     *
     * **내 전기가 있는 사건이 내 사건이다** — 이체는 양쪽에, 발행은 발행자에게 전기가 있다.
     * 전기 없는 사건은 상한 변경뿐이고 그것은 내역에 오르지 않는다 (docs/JOURNEY.md 여정 10).
     */
    @Query(
        "select e from JournalEntry e where (:pointTypeId is null or e.pointTypeId = :pointTypeId) " +
            "and exists (select p.id from Posting p where p.journalEntry = e and p.account.userId = :userId) " +
            "order by e.occurredAt desc, e.id desc",
    )
    fun visibleTo(userId: Long, pointTypeId: Long?, limit: Limit): List<JournalEntry>
}

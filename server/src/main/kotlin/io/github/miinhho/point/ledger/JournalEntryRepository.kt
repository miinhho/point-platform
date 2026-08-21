package io.github.miinhho.point.ledger

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

// 키만으로 찾는 메서드를 두지 않는다 — 키는 요청자와 함께여야 남의 것을 묻지 못한다.
interface JournalEntryRepository : JpaRepository<JournalEntry, Long> {
    /**
     * 내역. 세 목록을 각각 limit 으로 잘라 합치면 경계에서 항목이 사라지므로 **한 번에 자른다.**
     *
     * 내 전기가 있는 사건이 내 사건이다 — 이체는 양쪽에, 발행은 발행자에게만 전기가 있다.
     * 상한 변경은 전기가 없어 따로 연다: 그 포인트가 내 지갑에 담기면 약속이 바뀐 것도 본다.
     *
     * 같은 마이크로초의 순서는 id 가 가른다.
     */
    @Query(
        "select e from JournalEntry e where e.pointType.id in :pointTypeIds " +
            "and (:pointTypeId is null or e.pointType.id = :pointTypeId) " +
            "and (e.kind = io.github.miinhho.point.ledger.JournalKind.CAP_CHANGE " +
            "or exists (select p.id from Posting p where p.journalEntry = e and p.account.user.id = :userId)) " +
            "order by e.occurredAt desc, e.id desc",
    )
    fun visibleTo(userId: Long, pointTypeIds: Collection<Long>, pointTypeId: Long?, limit: Limit): List<JournalEntry>
}

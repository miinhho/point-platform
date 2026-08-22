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
     * 갈래가 셋이고 **앞의 둘은 인덱스로 좁혀진다** — 내 전기가 있는 사건(내 계정에서
     * 출발한다)과 내가 요청한 사건(`requester_id` 인덱스). 셋째만 포인트 목록을 훑는데,
     * 그 목록이 「회원인데 아직 아무것도 못 받은 은행」이라 대개 비어 있다.
     *
     * 셋째를 지우면 「들어왔지만 아직 없는 0」인 회원이 약속이 바뀐 것을 못 본다 — 그는
     * 상한이라는 약속을 받은 사람인데 그 기록만 안 오면 「아직 아무 일도 없었구나」로 읽는다.
     */
    @Query(
        "select e from JournalEntry e where (:pointTypeId is null or e.pointTypeId = :pointTypeId) and (" +
            "exists (select p.id from Posting p where p.journalEntry = e and p.account.userId = :userId) " +
            "or e.requesterId = :userId " +
            "or (e.kind = io.github.miinhho.point.ledger.JournalKind.CAP_CHANGE and e.pointTypeId in :unusedMemberOf)" +
            ") order by e.occurredAt desc, e.id desc",
    )
    fun visibleTo(userId: Long, unusedMemberOf: Collection<Long>, pointTypeId: Long?, limit: Limit): List<JournalEntry>
}

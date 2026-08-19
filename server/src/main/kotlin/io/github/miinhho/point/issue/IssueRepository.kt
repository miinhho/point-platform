package io.github.miinhho.point.issue

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface IssueRepository : JpaRepository<Issue, Long> {
    fun findByPublicId(publicId: UUID): Issue?

    // 키는 「내가 같은 요청을 두 번 보냈나」에 답한다 — 임자와 함께 찾는다.
    fun findByIssuerIdAndIdempotencyKey(issuerId: Long, idempotencyKey: String): Issue?

    @Query(
        "select i from Issue i where i.issuer.id = :userId " +
            "and (:pointTypeId is null or i.pointType.id = :pointTypeId) order by i.confirmedAt desc",
    )
    fun history(userId: Long, pointTypeId: Long?, limit: Limit): List<Issue>
}

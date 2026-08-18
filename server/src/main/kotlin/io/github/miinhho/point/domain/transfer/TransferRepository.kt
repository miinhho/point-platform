package io.github.miinhho.point.domain.transfer

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface TransferRepository : JpaRepository<Transfer, Long> {
    fun findByIdempotencyKey(idempotencyKey: String): Transfer?
    fun findByPublicId(publicId: UUID): Transfer?

    @Query(
        "select t from Transfer t where (t.from.id = :userId or t.to.id = :userId) " +
            "and (:pointTypeId is null or t.pointType.id = :pointTypeId) order by t.createdAt desc",
    )
    fun history(userId: Long, pointTypeId: Long?, limit: Limit): List<Transfer>

    // 포인트별 최근 대상 후보 — 서비스가 최신순으로 대상을 중복 제거해 limit 만큼 뽑는다.
    @Query(
        "select t from Transfer t where t.from.id = :userId and t.pointType.id = :pointTypeId " +
            "order by t.createdAt desc",
    )
    fun sentByPointType(userId: Long, pointTypeId: Long, limit: Limit): List<Transfer>
}

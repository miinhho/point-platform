package io.github.miinhho.point.domain.pointtype

import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface CapChangeRepository : JpaRepository<CapChange, Long> {
    fun findByIdempotencyKey(idempotencyKey: String): CapChange?

    // 그 포인트가 자기 지갑에 있는 사람과 발행자가 본다 — 발행자만 아는 변경은 약속이 아니다.
    // 지갑 판정은 호출부가 pointTypeIds 로 넘긴다.
    @Query(
        "select c from CapChange c where c.pointType.id in :pointTypeIds " +
            "and (:pointTypeId is null or c.pointType.id = :pointTypeId) order by c.changedAt desc",
    )
    fun visible(pointTypeIds: Collection<Long>, pointTypeId: Long?, limit: Limit): List<CapChange>
}

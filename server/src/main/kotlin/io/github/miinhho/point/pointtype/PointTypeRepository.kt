package io.github.miinhho.point.pointtype

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface PointTypeRepository : JpaRepository<PointType, Long> {
    // 조인으로 답한다 — 엔티티를 꺼내 issuer 를 열면 트랜잭션 밖에서 프록시가 안 열린다.
    fun existsByNameAndIssuerHandle(name: String, handle: String): Boolean

    fun findByPublicId(publicId: UUID): PointType?
    fun findByIssuerIdAndIdempotencyKey(issuerId: Long, idempotencyKey: String): PointType?

    // 겹치는 이름을 한 번에 모은다 — 지갑에 든 포인트마다 세면 N+1 이 된다.
    // 모수는 원장 전체다 (docs/API.md).
    @Query("select p.name from PointType p group by p.name having count(p) > 1")
    fun sharedNames(): Set<String>

    // 엔티티를 먼저 로드하지 않고 id 만 얻는다 — 이미 1차 캐시에 올라와 있으면
    // 아래 잠금 조회가 락은 잡되 낡은 값을 돌려줘서 상한 판정이 무의미해진다.
    @Query("select p.id from PointType p where p.publicId = :publicId")
    fun findIdByPublicId(publicId: UUID): Long?

    // 발행 상한 판정 중 행을 잠근다 — 여유를 각자 읽고 각자 발행하면 상한을 넘고,
    // 넘긴 포인트는 이미 남의 지갑에 있어 되돌릴 수 없다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PointType p where p.id = :id")
    fun findForUpdate(id: Long): PointType?
}

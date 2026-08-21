package io.github.miinhho.point.pointtype

import org.springframework.data.jpa.repository.JpaRepository
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

    @Query("select p.id from PointType p where p.issuer.id = :issuerId")
    fun idsIssuedBy(issuerId: Long): Set<Long>

    /**
     * 공개 은행과 내 관계가 있는 은행. 전부 읽어 메모리에서 거르면 은행이 늘수록 무거워진다.
     * 빈 목록은 넘기지 않는다 — `in ()` 은 문법이 아니라 드라이버가 거절한다.
     */
    fun publicOrRelated(relatedIds: Collection<Long>): List<PointType> =
        publicOrIn(relatedIds.ifEmpty { listOf(-1L) })

    @Query("select p from PointType p where p.visibility = io.github.miinhho.point.pointtype.PointVisibility.PUBLIC or p.id in :ids")
    fun publicOrIn(ids: Collection<Long>): List<PointType>

    @Query("select p.id from PointType p where p.publicId = :publicId")
    fun findIdByPublicId(publicId: UUID): Long?

    /**
     * 상한을 **현재 값으로** 읽는다. 일반 읽기는 REPEATABLE READ 스냅샷을 보므로, 공급을
     * 잠그기 전에 커밋된 상한 변경이 안 보인다 — 낡은 상한으로 발행이 통과한다.
     * 잠금 읽기만 현재를 본다. 공유 락이라 이체가 FK 로 잡는 같은 락과 부딪히지 않는다.
     */
    @Query(value = "select issue_cap from point_types where id = :id for share", nativeQuery = true)
    fun lockIssueCap(id: Long): Long?
}

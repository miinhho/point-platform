package io.github.miinhho.point.pointtype

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface PointTypeRepository : JpaRepository<PointType, Long> {
    // 조인으로 답한다 — 엔티티를 꺼내 issuer 를 열면 트랜잭션 밖에서 프록시가 안 열린다.
    fun existsByNameAndIssuerHandle(name: String, handle: String): Boolean

    fun findByPublicId(publicId: UUID): PointType?
    fun findByIssuerIdAndIdempotencyKey(issuerId: Long, idempotencyKey: String): PointType?

    /** 이 이름들 중 겹치는 것. 모수는 원장 전체이고 묻는 이름만 좁힌다 (docs/API.md). */
    fun sharedNames(names: Collection<String>): Set<String> =
        if (names.isEmpty()) emptySet() else sharedAmong(names.toSet())

    @Query("select p.name from PointType p where p.name in :names group by p.name having count(p.id) > 1")
    fun sharedAmong(names: Collection<String>): Set<String>

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

}

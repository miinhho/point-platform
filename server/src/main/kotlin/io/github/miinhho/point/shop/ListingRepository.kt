package io.github.miinhho.point.shop

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant
import java.util.UUID

interface ListingRepository : JpaRepository<Listing, Long> {
    fun findByPublicId(publicId: UUID): Listing?

    // 게시할 수 있는 사람은 은행장 하나뿐이라 은행이 곧 임자다 — 남이 내 키를 선점하지 못한다.
    fun findByPointTypeIdAndIdempotencyKey(pointTypeId: Long, idempotencyKey: String): Listing?

    @Query("select l from Listing l where l.pointTypeId = :pointTypeId order by l.createdAt desc, l.id desc")
    fun ofPointType(pointTypeId: Long): List<Listing>

    /**
     * 품목 행을 잠그고 **바뀔 수 있는 것만** 준다. 구매·재고 수정·내리기가 여기를 지난다.
     *
     * 값을 이 문장에서 받는 이유는 상한과 같다 — 잠근 뒤에 다시 읽으면 그 읽기는
     * REPEATABLE READ 스냅샷이라 잠그기 전에 커밋된 변경이 안 보인다.
     * 행이 없으면 빈 목록이다: 아직 아무도 안 산 품목은 내릴 때 행째 사라진다.
     */
    @Query(
        value = "select stock, per_person_limit, unlisted_at from listings where id = :id for update",
        nativeQuery = true,
    )
    fun lockListing(id: Long): List<Array<Any?>>

    /** 값을 통째로 덮는다 — 엔티티 더티 체킹은 낡은 `unlisted_at` 까지 함께 써서 내린 것을 되살린다. */
    @Modifying(flushAutomatically = true)
    @Query(
        value = "update listings set stock = :stock, per_person_limit = :perPersonLimit, " +
            "description = :description where id = :id and unlisted_at is null",
        nativeQuery = true,
    )
    fun edit(id: Long, stock: Int?, perPersonLimit: Int?, description: String?): Int

    @Modifying(flushAutomatically = true)
    @Query(value = "update listings set unlisted_at = :now where id = :id and unlisted_at is null", nativeQuery = true)
    fun unlist(id: Long, now: Instant): Int

    /** 아무도 안 샀을 때만 부른다. 교환권이 가리키는 행은 지우지 않는다. */
    @Modifying(flushAutomatically = true)
    @Query(value = "delete from listings where id = :id", nativeQuery = true)
    fun remove(id: Long): Int
}

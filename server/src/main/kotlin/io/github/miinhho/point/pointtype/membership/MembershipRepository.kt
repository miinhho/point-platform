package io.github.miinhho.point.pointtype.membership

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface MembershipRepository : JpaRepository<Membership, MembershipId> {
    @Query("select m.id.pointTypeId from Membership m where m.id.userId = :userId")
    fun pointTypeIdsOf(userId: Long): Set<Long>

    @Query("select m.id.userId from Membership m where m.id.pointTypeId = :pointTypeId")
    fun userIdsOf(pointTypeId: Long): Set<Long>

    // 한 문장으로 지운다. deleteById 는 읽고 지우는 두 문장이라 같은 자격을 동시에 지우면
    // 진 쪽이 이미 없는 행을 지우려다 낙관적 락 실패로 500 이다 — 0 행은 그냥 0 행이어야 한다.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from Membership m where m.id.pointTypeId = :pointTypeId and m.id.userId = :userId")
    fun remove(pointTypeId: Long, userId: Long): Int

    // 회원 수는 은행마다 세면 목록에서 N+1 이 된다. 화면에 담길 은행만 한 번에 센다.
    @Query("select m.id.pointTypeId, count(m) from Membership m where m.id.pointTypeId in :pointTypeIds group by m.id.pointTypeId")
    fun countsOf(pointTypeIds: Collection<Long>): List<Array<Any>>
}

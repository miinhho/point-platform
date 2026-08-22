package io.github.miinhho.point.pointtype

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface MembershipRepository : JpaRepository<Membership, MembershipId> {
    @Query("select m.id.pointTypeId from Membership m where m.id.userId = :userId")
    fun pointTypeIdsOf(userId: Long): Set<Long>

    @Query("select m.id.userId from Membership m where m.id.pointTypeId = :pointTypeId")
    fun userIdsOf(pointTypeId: Long): Set<Long>

    // 회원 수는 은행마다 세면 목록에서 N+1 이 된다. 화면에 담길 은행만 한 번에 센다.
    @Query("select m.id.pointTypeId, count(m) from Membership m where m.id.pointTypeId in :pointTypeIds group by m.id.pointTypeId")
    fun countsOf(pointTypeIds: Collection<Long>): List<Array<Any>>
}

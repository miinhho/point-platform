package io.github.miinhho.point.pointtype.membership

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface InviteRepository : JpaRepository<Invite, Long> {

    // 키는 「내가 같은 요청을 두 번 보냈나」에 답한다 — 임자와 함께 찾는다.
    fun findByByIdAndIdempotencyKey(byId: Long, idempotencyKey: String): Invite?

    fun findByPointTypeIdAndUserIdAndSpentAtIsNull(pointTypeId: Long, userId: Long): Invite?

    fun findByUserIdAndSpentAtIsNullOrderByCreatedAtDesc(userId: Long): List<Invite>

    // 소진된 초대는 닿을 자격을 주지 않는다 — 내보내진 사람이 은행 페이지를 계속 보게 된다.
    @Query("select i.pointType.id from Invite i where i.user.id = :userId and i.spentAt is null")
    fun pointTypeIdsInvitedTo(userId: Long): Set<Long>

}

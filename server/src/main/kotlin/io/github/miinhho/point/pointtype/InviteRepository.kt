package io.github.miinhho.point.pointtype

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface InviteRepository : JpaRepository<Invite, Long> {
    fun findByPublicId(publicId: UUID): Invite?
    fun findByPointTypeIdAndUserId(pointTypeId: Long, userId: Long): Invite?
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Invite>

    @Query("select i.pointType.id from Invite i where i.user.id = :userId")
    fun pointTypeIdsInvitedTo(userId: Long): Set<Long>
}

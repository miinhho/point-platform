package io.github.miinhho.point.pointtype.membership

import io.github.miinhho.point.user.User
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.MapsId
import jakarta.persistence.Table
import java.time.Instant
import io.github.miinhho.point.pointtype.PointType

@Entity
@Table(name = "memberships", indexes = [Index(name = "ix_memberships_user", columnList = "user_id")])
class Membership(
    pointType: PointType,
    user: User,
) {
    @EmbeddedId
    val id: MembershipId = MembershipId(requireNotNull(pointType.id), requireNotNull(user.id))

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("pointTypeId")
    @JoinColumn(name = "point_type_id")
    val pointType: PointType = pointType

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    val user: User = user

    @Column(name = "joined_at", nullable = false, updatable = false)
    val joinedAt: Instant = Instant.now()

    override fun equals(other: Any?) = other is Membership && id == other.id
    override fun hashCode() = id.hashCode()
}

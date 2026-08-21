package io.github.miinhho.point.membership

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import java.io.Serializable

@Embeddable
class MembershipId(
    @Column(name = "point_type_id")
    val pointTypeId: Long,

    @Column(name = "user_id")
    val userId: Long,
) : Serializable {
    override fun equals(other: Any?) =
        other is MembershipId && pointTypeId == other.pointTypeId && userId == other.userId

    override fun hashCode() = 31 * pointTypeId.hashCode() + userId.hashCode()
}

package io.github.miinhho.point.domain.balance

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import java.io.Serializable

@Embeddable
class BalanceId(
    @Column(name = "user_id")
    val userId: Long,

    @Column(name = "point_type_id")
    val pointTypeId: Long,
) : Serializable {
    override fun equals(other: Any?) =
        other is BalanceId && userId == other.userId && pointTypeId == other.pointTypeId

    override fun hashCode() = 31 * userId.hashCode() + pointTypeId.hashCode()
}

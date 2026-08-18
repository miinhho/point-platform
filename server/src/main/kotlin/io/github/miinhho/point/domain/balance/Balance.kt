package io.github.miinhho.point.domain.balance

import io.github.miinhho.point.domain.pointtype.PointType
import io.github.miinhho.point.domain.user.User
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.MapsId
import jakarta.persistence.Table

// Hibernate 는 @EmbeddedId 컬럼을 선언 순서가 아니라 알파벳 순으로 내보낸다 (point_type_id, user_id).
// "이 사용자의 잔액 전부" 조회(GET /wallet)가 PK 의 leftmost prefix 를 타지 못하므로 별도 인덱스를 둔다.
@Entity
@Table(name = "balances", indexes = [Index(name = "ix_balances_user", columnList = "user_id")])
class Balance(
    user: User,
    pointType: PointType,
    @Column(nullable = false)
    var amount: Long = 0,

    // 처음 받은 뒤 사용자가 확인했는가. 발행자는 응답에서 항상 참으로 나간다.
    @Column(nullable = false)
    var acknowledged: Boolean = false,
) {
    @EmbeddedId
    val id: BalanceId = BalanceId(requireNotNull(user.id), requireNotNull(pointType.id))

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    val user: User = user

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("pointTypeId")
    @JoinColumn(name = "point_type_id")
    val pointType: PointType = pointType

    override fun equals(other: Any?) = other is Balance && id == other.id
    override fun hashCode() = id.hashCode()
}

package io.github.miinhho.point.ledger

import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

// 잔액은 전기의 합을 접어 둔 것이다. 판정에 쓸 수 있는 이유는 같은 트랜잭션에서 잠글 수
// 있어서고, 지연될 수 있는 사본은 못 쓴다 — docs/LEDGER.md.
@Entity
@Table(name = "accounts")
class Account(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "point_type_id", nullable = false)
    val pointType: PointType,

    /** 발행 계정에는 보유자가 없다. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    val user: User?,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    val kind: AccountKind,

    @Column(nullable = false)
    var balance: Long = 0,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    override fun equals(other: Any?) = other is Account && id != null && id == other.id
    override fun hashCode() = id?.hashCode() ?: 0
}

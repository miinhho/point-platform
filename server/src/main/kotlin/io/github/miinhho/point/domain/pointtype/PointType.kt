package io.github.miinhho.point.domain.pointtype

import io.github.miinhho.point.domain.user.User
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
import java.util.UUID

@Entity
@Table(name = "point_types")
class PointType(
    @Column(nullable = false, length = 50)
    var name: String,

    @Column(nullable = false, unique = true, length = 10)
    var symbol: String,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issuer_id", nullable = false)
    var issuer: User,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    var accent: PointAccent,

    @Column(name = "issue_cap", nullable = false)
    var issueCap: Long,

    @Column(name = "total_issued", nullable = false)
    var totalIssued: Long = 0,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    // symbol 은 var 라 바뀔 수 있으므로 equals/hashCode 의 기준으로 쓰지 않는다.
    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    override fun equals(other: Any?) = other is PointType && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

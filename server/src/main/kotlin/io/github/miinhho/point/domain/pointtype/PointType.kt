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
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
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

    // 창설도 되돌릴 수 없다. 응답을 못 받은 사용자가 다시 눌러 같은 이름이 둘 생기면
    // 어느 것이 자기 것인지 알 방법이 없다. 시드로 만든 것은 키가 없다.
    @Column(name = "idempotency_key", unique = true, length = 36, updatable = false)
    var idempotencyKey: String? = null,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    // symbol 은 var 라 바뀔 수 있으므로 equals/hashCode 의 기준으로 쓰지 않는다.
    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    // 기호 unique 는 정규화된 형태에 걸려야 한다 — 조회만 정규화하면 GM 과 gm 두 행이
    // 공존하고, 그러면 「전체에서 유일」이 깨진다 (docs/API.md 「동시에 왔을 때」).
    @PrePersist
    @PreUpdate
    protected fun normalize() {
        symbol = symbol.trim().uppercase()
    }

    override fun equals(other: Any?) = other is PointType && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

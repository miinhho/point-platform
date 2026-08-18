package io.github.miinhho.point.domain.pointtype

import io.github.miinhho.point.domain.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

// 상한 변경은 되돌릴 수 없고 이력에 남는다. 낮추는 것도 취소가 아니다 —
// 올려 둔 동안 발행된 것은 이미 남의 지갑에 있다 (docs/JOURNEY.md 여정 9).
@Entity
@Table(
    name = "cap_changes",
    indexes = [Index(name = "ix_cap_changes_point_type", columnList = "point_type_id,changed_at")],
)
class CapChange(
    @Column(name = "idempotency_key", nullable = false, length = 36, updatable = false)
    val idempotencyKey: String,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "point_type_id", nullable = false)
    val pointType: PointType,

    /** 바꾼 사람. 그 포인트의 발행자다. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "by_id", nullable = false)
    val by: User,

    @Column(name = "previous_cap", nullable = false)
    val previousCap: Long,

    @Column(name = "issue_cap", nullable = false)
    val issueCap: Long,

    @Column(name = "changed_at", nullable = false, updatable = false)
    val changedAt: Instant = Instant.now(),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    override fun equals(other: Any?) = other is CapChange && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

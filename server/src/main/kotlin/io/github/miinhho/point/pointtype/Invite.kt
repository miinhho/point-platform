package io.github.miinhho.point.pointtype

import io.github.miinhho.point.user.User
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
import java.time.temporal.ChronoUnit
import java.util.UUID

// 거절도 취소도 없다. 수락·나가기·내보내기 셋에서 소진된다 (docs/API.md 「회원 자격」).
@Entity
@Table(name = "invites", indexes = [Index(name = "ix_invites_user", columnList = "user_id, created_at")])
class Invite(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "point_type_id", nullable = false)
    val pointType: PointType,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    /** 초대한 사람. 은행장이다. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "by_id", nullable = false)
    val by: User,

    @Column(name = "idempotency_key", nullable = false, length = 36, updatable = false)
    val idempotencyKey: String,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS),
) {
    /** 소진된 때. 행은 남는다 — 다시 누른 사람에게 그 초대가 어떻게 됐는지 답해야 한다. */
    @Column(name = "spent_at")
    var spentAt: Instant? = null
        protected set

    fun spend() {
        if (spentAt == null) spentAt = Instant.now().truncatedTo(ChronoUnit.MICROS)
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    override fun equals(other: Any?) = other is Invite && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

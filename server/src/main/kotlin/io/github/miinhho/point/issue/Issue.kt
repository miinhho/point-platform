package io.github.miinhho.point.issue

import io.github.miinhho.point.pointtype.PointType
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

// 대상이 없다. 발행자가 곧 받는 사람이라 칸이 하나다 (docs/API.md 「발행은 이체가 아니다」).
@Entity
@Table(
    name = "issues",
    indexes = [
        Index(name = "ix_issues_issuer", columnList = "issuer_id,confirmed_at"),
        Index(name = "ix_issues_point_type", columnList = "point_type_id,confirmed_at"),
    ],
)
class Issue(
    @Column(name = "idempotency_key", nullable = false, length = 36)
    val idempotencyKey: String,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issuer_id", nullable = false)
    val issuer: User,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "point_type_id", nullable = false)
    val pointType: PointType,

    @Column(nullable = false)
    val amount: Long,

    // 일어난 일은 일어난 때의 값을 갖는다 — 지금 값에서 거꾸로 계산할 수 없다.
    @Column(name = "total_issued_after", nullable = false)
    val totalIssuedAfter: Long,

    @Column(name = "issue_cap_at", nullable = false)
    val issueCapAt: Long,

    // datetime(6) 은 마이크로초다. 나노초를 그대로 두면 만든 직후의 응답과 다시 읽은
    // 응답이 달라져 「같은 키면 그때 것을 그대로 준다」가 문자열에서 깨진다.
    @Column(name = "confirmed_at", nullable = false)
    val confirmedAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    override fun equals(other: Any?) = other is Issue && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

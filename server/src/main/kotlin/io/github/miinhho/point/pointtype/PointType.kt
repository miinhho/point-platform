package io.github.miinhho.point.pointtype

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
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "point_types")
class PointType(
    @Column(nullable = false, length = 50)
    var name: String,

    // 유일하지 않다 — 알아보는 표식이지 가리키는 표식이 아니다. 무엇을 가르는 데 쓰지 않는다.
    @Column(nullable = false, length = 32)
    var emoji: String,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issuer_id", nullable = false)
    var issuer: User,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    var accent: PointAccent,

    // 창설 시 정해지고 바뀌지 않는다. 바꾸면 이미 받은 사람이 회원 아닌 채로 잔액만 남거나
    // 초대로만 닿던 것이 모두에게 열린다 — 사람에게 일어나는 일이지 설정 변경이 아니다.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    val visibility: PointVisibility,

    // 약속이 아니라 소개다. 상한과 달리 바꿔도 이력에 남지 않는다.
    @Column(length = 255)
    var description: String? = null,

    @Column(name = "issue_cap", nullable = false)
    var issueCap: Long,

    @Column(name = "total_issued", nullable = false)
    var totalIssued: Long = 0,

    // 창설도 되돌릴 수 없다. 응답을 못 받은 사용자가 다시 눌러 같은 이름이 둘 생기면
    // 어느 것이 자기 것인지 알 방법이 없다. 시드로 만든 것은 키가 없다.
    @Column(name = "idempotency_key", length = 36, updatable = false)
    var idempotencyKey: String? = null,

    // 발행자가 정할 수 없는 사실 — 오래된 것은 흉내낼 수 없다 (docs/API.md 「흉내낼 수 없는 것」).
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    override fun equals(other: Any?) = other is PointType && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

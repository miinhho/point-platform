package io.github.miinhho.point.shop

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * 산 것을 실제 물건으로 바꿀 권리. 원장 밖의 기록이고 **한 장이 한 개다** — 「세 잔짜리
 * 한 장」은 없다. 부분적으로 쓰인 상태를 만들지 않는다 (docs/JOURNEY.md 여정 13).
 *
 * 가진 사람도 발행 시각도 품목도 여기 없다 — 전부 [Purchase] 와 그 사건이 아는 것이다.
 */
@Entity
@Table(name = "vouchers")
class Voucher(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purchase_id", nullable = false, updatable = false)
    val purchase: Purchase,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    /** 두 번째 redeem 이 덮지 않는다 — 덮으면 「커피를 건넨 때」가 거짓이 된다. */
    @Column(name = "redeemed_at")
    var redeemedAt: Instant? = null

    override fun equals(other: Any?) = other is Voucher && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

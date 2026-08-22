package io.github.miinhho.point.shop

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * 은행장이 포인트로 살 수 있다고 내건 것. **이 행이 그 품목의 뮤텍스다** — 구매·재고
 * 수정·내리기 셋 다 잠그고 읽는다 (docs/API.md 「상점」).
 *
 * 판 수를 접어 두는 칸이 없다. 그 품목의 교환권을 센다.
 *
 * 은행을 id 로만 안다 — 원장이 포인트를 타입으로 모르는 것과 같은 이유다. 알면 품목
 * 하나를 잠그려고 은행을 함께 열게 되고, 목록 한 화면이 조회 서른 번이 된다.
 */
@Entity
@Table(name = "listings")
class Listing(
    @Column(name = "point_type_id", nullable = false, updatable = false)
    val pointTypeId: Long,

    // 이름과 값은 바꾸지 않는다 — 바꾸면 이미 산 사람의 교환권이 가리키는 것이 바뀐다.
    @Column(nullable = false, length = 80, updatable = false)
    val name: String,

    @Column(nullable = false, updatable = false)
    val price: Long,

    /** 약속한 개수. null 은 무제한 — 기본값이 아니라 게시할 때 고른 것이다. */
    @Column
    var stock: Int? = null,

    @Column(name = "per_person_limit")
    var perPersonLimit: Int? = null,

    @Column(length = 255)
    var description: String? = null,

    @Column(name = "idempotency_key", nullable = false, length = 36, updatable = false)
    val idempotencyKey: String,

    // datetime(6) 은 마이크로초다. 나노초를 두면 만든 직후와 다시 읽은 값이 달라진다.
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    /** 내린 시각. 되살리는 길은 없다 — 다시 팔려면 새로 게시한다. 그것은 새 약속이다. */
    @Column(name = "unlisted_at")
    var unlistedAt: Instant? = null

    val unlisted: Boolean get() = unlistedAt != null

    override fun equals(other: Any?) = other is Listing && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}

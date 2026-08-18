package io.github.miinhho.point.domain.auth

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

// 회전(rotation)·재사용 탐지를 위한 테이블. 원문 토큰은 저장하지 않고 해시만 둔다.
@Entity
@Table(
    name = "refresh_tokens",
    indexes = [Index(name = "ix_refresh_tokens_family_active", columnList = "family_id,revoked_at")],
)
class RefreshToken(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    val tokenHash: String,

    // 로그인 1회가 만든 회전 사슬 전체를 묶는 id. 재사용 탐지 시 이 값으로 사슬 전체를 한 번에 무효화한다.
    @Column(name = "family_id", nullable = false)
    val familyId: UUID,

    @Column(name = "expires_at", nullable = false)
    val expiresAt: Instant,

    // 회전으로 이 토큰을 대체한 다음 토큰.
    @Column(name = "replaced_by_hash", length = 64)
    var replacedByHash: String? = null,

    @Column(name = "revoked_at")
    var revokedAt: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    override fun equals(other: Any?) = other is RefreshToken && tokenHash == other.tokenHash
    override fun hashCode() = tokenHash.hashCode()
}

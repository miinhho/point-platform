package io.github.miinhho.point.auth

import io.github.miinhho.point.domain.auth.RefreshToken
import io.github.miinhho.point.domain.auth.RefreshTokenRepository
import io.github.miinhho.point.domain.user.User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.Base64
import java.util.UUID

@Service
class RefreshTokenService(
    private val refreshTokenRepository: RefreshTokenRepository,
    props: JwtProperties,
) {
    private val refreshTtl = props.refreshTtl
    private val random = SecureRandom()

    @Transactional
    fun issue(user: User): String {
        val raw = randomToken()
        refreshTokenRepository.save(
            RefreshToken(
                user = user,
                tokenHash = hash(raw),
                familyId = UUID.randomUUID(),
                expiresAt = Instant.now().plus(refreshTtl),
            ),
        )
        return raw
    }

    /** 회전. 이미 폐기된 토큰이 다시 오면 탈취로 간주하고 같은 사슬 전체를 무효화한다. */
    @Transactional
    fun rotate(rawToken: String): Pair<String, User> {
        val tokenHash = hash(rawToken)
        val current = refreshTokenRepository.findByTokenHash(tokenHash)
            ?: throw InvalidRefreshTokenException("알 수 없는 refresh 토큰")

        if (current.revokedAt != null) {
            refreshTokenRepository.revokeFamily(current.familyId, Instant.now())
            throw InvalidRefreshTokenException("이미 폐기된 refresh 토큰이 재사용됨")
        }
        if (current.expiresAt.isBefore(Instant.now())) {
            throw InvalidRefreshTokenException("만료된 refresh 토큰")
        }

        val raw = randomToken()
        val nextHash = hash(raw)
        // 조건부 UPDATE 가 실패(영향 행 0)했다면 동시 요청이 먼저 이겼다는 뜻이다 — 재사용과 같게 다룬다.
        val won = refreshTokenRepository.markRotated(tokenHash, nextHash, Instant.now()) == 1
        if (!won) {
            refreshTokenRepository.revokeFamily(current.familyId, Instant.now())
            throw InvalidRefreshTokenException("동시 회전 충돌")
        }

        refreshTokenRepository.save(
            RefreshToken(
                user = current.user,
                tokenHash = nextHash,
                familyId = current.familyId,
                expiresAt = Instant.now().plus(refreshTtl),
            ),
        )
        return raw to current.user
    }

    @Transactional
    fun revoke(rawToken: String) {
        val current = refreshTokenRepository.findByTokenHash(hash(rawToken)) ?: return
        refreshTokenRepository.revokeFamily(current.familyId, Instant.now())
    }

    private fun randomToken(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun hash(raw: String): String =
        MessageDigest.getInstance("SHA-256").digest(raw.toByteArray())
            .joinToString("") { "%02x".format(it) }
}

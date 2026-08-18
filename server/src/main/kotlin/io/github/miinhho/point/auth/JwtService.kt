package io.github.miinhho.point.auth

import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.io.Decoders
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.Date

// access 토큰만 다룬다 — refresh 는 자기 서술적일 필요가 없어 RefreshTokenService 가 불투명한 값으로 다룬다.
@Component
class JwtService(props: JwtProperties) {
    private val key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(props.secret))
    private val accessTtl = props.accessTtl

    fun generateAccessToken(userId: Long): String {
        val now = Instant.now()
        return Jwts.builder()
            .subject(userId.toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(accessTtl)))
            .signWith(key)
            .compact()
    }

    /** 서명·만료 검증에 실패하면 null. 인증되지 않은 요청과 같게 취급한다. */
    fun parseUserId(token: String): Long? =
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload.subject.toLong()
        } catch (_: JwtException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
}

package io.github.miinhho.point.auth

import io.github.miinhho.point.api.toResponse
import io.github.miinhho.point.domain.user.UserRepository
import io.github.miinhho.point.domain.user.normalizeHandle
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 핸들 부재와 암호 불일치의 응답 시간을 맞추는 용도. 실제 사용자 것이 아니다.
private const val DUMMY_PASSWORD_HASH = "\$2b\$12\$UZ2ychI/VegX4Y49IunpneznkG8wKOg7jfFy7LIg7rNKH4E32.vuC"

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    private val refreshTokenService: RefreshTokenService,
) {
    @PostMapping("/login")
    fun login(@RequestBody body: LoginRequest): LoginResponse {
        val found = userRepository.findByHandle(normalizeHandle(body.handle))
        // 핸들이 없어도 BCrypt 를 한 번 돌려 시간을 맞춘다 — 안 그러면 응답 시간차로 존재 여부가 샌다.
        val matches = passwordEncoder.matches(body.password, found?.passwordHash ?: DUMMY_PASSWORD_HASH)
        val user = found?.takeIf { matches } ?: throw BadCredentialsException("핸들 또는 암호가 틀림")

        return LoginResponse(
            accessToken = jwtService.generateAccessToken(user.id!!),
            refreshToken = refreshTokenService.issue(user),
            user = user.toResponse(),
        )
    }

    @PostMapping("/refresh")
    fun refresh(@RequestBody body: RefreshRequest): TokenPairResponse {
        val (nextRefresh, user) = refreshTokenService.rotate(body.refreshToken)
        return TokenPairResponse(jwtService.generateAccessToken(user.id!!), nextRefresh)
    }

    @PostMapping("/logout")
    fun logout(@RequestBody(required = false) body: LogoutRequest?): ResponseEntity<Unit> {
        body?.refreshToken?.let(refreshTokenService::revoke)
        return ResponseEntity.noContent().build()
    }
}

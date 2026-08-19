package io.github.miinhho.point.auth

import io.github.miinhho.point.user.toResponse
import jakarta.servlet.http.HttpServletRequest
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.user.normalizeHandle
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
    private val loginThrottle: LoginThrottle,
) {
    @PostMapping("/login")
    fun login(@RequestBody body: LoginRequest, request: HttpServletRequest): LoginResponse {
        val handle = normalizeHandle(body.handle)
        val ip = request.remoteAddr ?: "unknown"
        val found = userRepository.findByHandle(handle)
        // 핸들이 없어도 BCrypt 를 한 번 돌려 시간을 맞춘다 — 안 그러면 응답 시간차로 존재 여부가 샌다.
        val matches = passwordEncoder.matches(body.password, found?.passwordHash ?: DUMMY_PASSWORD_HASH)

        // 잠긴 동안에는 암호가 맞아도 같은 답이다. 여기서 다른 말을 하면 그것이 곧
        // 「그 핸들은 있다」이고, 문구를 같게 유지한 이유가 사라진다.
        val user = found?.takeIf { matches && !loginThrottle.isLocked(handle, ip) }
            ?: run {
                loginThrottle.recordFailure(handle, ip)
                throw BadCredentialsException("핸들 또는 암호가 틀림")
            }
        loginThrottle.clear(handle, ip)

        return LoginResponse(
            accessToken = jwtService.generateAccessToken(user.id!!),
            refreshToken = refreshTokenService.issue(user),
            user = user.toResponse(userRepository.sharedNames()),
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

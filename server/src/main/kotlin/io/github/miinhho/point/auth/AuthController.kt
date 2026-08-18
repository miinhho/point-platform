package io.github.miinhho.point.auth

import io.github.miinhho.point.domain.user.UserRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

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
        val user = userRepository.findByHandle(body.handle)?.takeIf {
            passwordEncoder.matches(body.password, it.passwordHash)
        } ?: throw BadCredentialsException("핸들 또는 암호가 틀림")

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

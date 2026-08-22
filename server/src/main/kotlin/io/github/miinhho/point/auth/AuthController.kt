package io.github.miinhho.point.auth

import io.github.miinhho.point.user.toResponse
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.user.normalizeHandle
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val userRepository: UserRepository,
    private val passwordCheck: PasswordCheck,
    private val jwtService: JwtService,
    private val refreshTokenService: RefreshTokenService,
) {
    @PostMapping("/login")
    fun login(@RequestBody body: LoginRequest): LoginResponse {
        val found = userRepository.findByHandle(normalizeHandle(body.handle))
        // 요청 수 제한은 이것을 대신 막지 못한다 — 핸들 목록을 만드는 데는 계정당 한 번이면 된다.
        val matches = passwordCheck.matches(body.password, found?.passwordHash)
        val user = found?.takeIf { matches } ?: throw BadCredentialsException("핸들 또는 암호가 틀림")

        return LoginResponse(
            accessToken = jwtService.generateAccessToken(user.id!!),
            refreshToken = refreshTokenService.issue(user),
            user = user.toResponse(userRepository.sharedNames(listOf(user.name))),
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

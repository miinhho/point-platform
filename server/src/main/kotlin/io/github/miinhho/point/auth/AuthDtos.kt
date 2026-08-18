package io.github.miinhho.point.auth

import io.github.miinhho.point.user.UserResponse
import io.github.miinhho.point.user.toResponse

data class LoginRequest(val handle: String, val password: String)
data class RefreshRequest(val refreshToken: String)
data class LogoutRequest(val refreshToken: String?)

data class LoginResponse(val accessToken: String, val refreshToken: String, val user: UserResponse)
data class TokenPairResponse(val accessToken: String, val refreshToken: String)

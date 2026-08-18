package io.github.miinhho.point.auth

import io.github.miinhho.point.domain.user.User

data class LoginRequest(val handle: String, val password: String)
data class RefreshRequest(val refreshToken: String)
data class LogoutRequest(val refreshToken: String?)

data class UserResponse(val id: String, val name: String, val handle: String)
data class LoginResponse(val accessToken: String, val refreshToken: String, val user: UserResponse)
data class TokenPairResponse(val accessToken: String, val refreshToken: String)

fun User.toResponse() = UserResponse(id = publicId.toString(), name = name, handle = handle)

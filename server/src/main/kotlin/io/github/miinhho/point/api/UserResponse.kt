package io.github.miinhho.point.api

import io.github.miinhho.point.domain.user.User

data class UserResponse(val id: String, val name: String, val handle: String)

fun User.toResponse() = UserResponse(id = publicId.toString(), name = name, handle = handle)

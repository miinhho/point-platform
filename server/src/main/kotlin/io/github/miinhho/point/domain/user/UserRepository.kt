package io.github.miinhho.point.domain.user

import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<User, Long> {
    fun findByHandle(handle: String): User?
}

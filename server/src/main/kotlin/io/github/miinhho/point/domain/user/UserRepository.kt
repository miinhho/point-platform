package io.github.miinhho.point.domain.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserRepository : JpaRepository<User, Long> {
    fun findByHandle(handle: String): User?
    fun findByPublicId(publicId: UUID): User?
}

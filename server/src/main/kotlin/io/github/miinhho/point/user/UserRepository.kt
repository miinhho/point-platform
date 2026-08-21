package io.github.miinhho.point.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface UserRepository : JpaRepository<User, Long> {
    fun findByHandle(handle: String): User?
    fun findByPublicId(publicId: UUID): User?

    // 겹치는 이름을 한 번에 모은다 — 내보내는 사용자마다 세면 N+1 이 된다.
    // 모수는 언제나 원장 전체다. 응답에 담긴 목록에서 세면 겹치는 둘 중 하나만
    // 담긴 응답에서 방어가 조용히 꺼진다 (docs/API.md).
    @Query("select u.name from User u group by u.name having count(u) > 1")
    fun sharedNames(): Set<String>

    /**
     * 이름이나 핸들이 걸리는 사람과 **그 이름을 쓰는 전원**. 결과 안에서만 겹침을 세면
     * 핸들로 검색해 한 명만 나올 때 동명이인 방어가 꺼진다 (docs/API.md).
     */
    @Query(
        "select u from User u where lower(u.handle) like %:needle% " +
            "or u.name in (select v.name from User v where lower(v.name) like %:needle% or lower(v.handle) like %:needle%)",
    )
    fun matching(needle: String): List<User>
}

package io.github.miinhho.point.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface UserRepository : JpaRepository<User, Long> {
    fun findByHandle(handle: String): User?
    fun findByPublicId(publicId: UUID): User?

    /**
     * 이 이름들 중 겹치는 것. **모수는 언제나 원장 전체다** — 그 이름을 쓰는 행을 전부 세고,
     * 묻는 이름만 좁힌다. 응답에 담긴 목록에서 세면 겹치는 둘 중 하나만 담긴 응답에서
     * 방어가 조용히 꺼진다 (docs/API.md).
     *
     * 전체 겹침 집합을 가져오지 않는다 — 그러면 응답을 만들 때마다 표를 통째로 훑는다.
     */
    fun sharedNames(names: Collection<String>): Set<String> =
        if (names.isEmpty()) emptySet() else sharedAmong(names.toSet())

    @Query("select u.name from User u where u.name in :names group by u.name having count(u.id) > 1")
    fun sharedAmong(names: Collection<String>): Set<String>

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

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
     * 이름이나 핸들이 걸리는 사람. **동명이인은 호출부가 [byNames] 로 더한다** — 한 쿼리에
     * 서브쿼리로 담으면 그 서브쿼리가 표를 한 번 더 훑는다.
     *
     * 두 글자부터는 전문 인덱스가 답한다. ngram 파서가 두 글자 토큰으로 쪼개므로 한 글자는
     * 그 인덱스에 없고, 그때만 훑는다 — 화면에서 한 글자를 치는 순간 결과가 사라지는 것이
     * 회귀라서 갈래를 남긴다.
     */
    fun matching(needle: String): List<User> =
        if (needle.length < 2) scanningFor(needle) else indexedFor("\"$needle\"")

    // 따옴표로 감싼 boolean mode 는 토큰 순서까지 본다 — 감싸지 않으면 「수지」가 「지수」를 문다.
    @Query(
        value = "select * from users where match(name, handle) against (:phrase in boolean mode)",
        nativeQuery = true,
    )
    fun indexedFor(phrase: String): List<User>

    @Query("select u from User u where lower(u.name) like %:needle% or lower(u.handle) like %:needle%")
    fun scanningFor(needle: String): List<User>

    /** 이 이름을 쓰는 전원. 겹친다는 것은 결과의 성질이 아니라 원장의 성질이다 (docs/API.md). */
    fun findByNameIn(names: Collection<String>): List<User>
}

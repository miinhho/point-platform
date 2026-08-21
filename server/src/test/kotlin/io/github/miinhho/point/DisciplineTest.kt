package io.github.miinhho.point

import org.junit.jupiter.api.Test
import java.nio.file.Path
import kotlin.io.path.extension
import kotlin.io.path.readText
import kotlin.io.path.walk
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * 소스를 훑어 규율을 검사한다. 규율은 지키기로 한 순간이 아니라 **어긴 것이 빨개지는 순간**
 * 부터 규율이다 — 주석으로 적어 둔 것은 다음 사람이 모른다.
 *
 * 근거: docs/LEDGER.md 「무엇이 뿌리이고 무엇이 패치인가」.
 */
class DisciplineTest {
    @Test
    fun `잔액을 바꾸는 문장은 적용부에만 있다`() {
        val callers = sourcesOutside("ledger").filter { (_, text) -> BALANCE_WRITES.any { it in text } }
        assertEquals(emptyList(), callers.map { it.first }, "적용부 밖에서 잔액을 바꾼다 — 락 순서와 전기가 그 자리를 안 지난다")
    }

    // 읽는 것은 막지 않는다 — 내역이 사건을 읽어야 세 목록을 합치지 않는다.
    @Test
    fun `사건과 전기를 쓰는 것은 적용부에만 있다`() {
        val callers = sourcesOutside("ledger").filter { (_, text) -> LEDGER_WRITES.any { it in text } }
        assertEquals(emptyList(), callers.map { it.first }, "밖에서 사건을 적으면 잔액 없는 사건이나 사건 없는 잔액이 생긴다")
    }

    /**
     * 바깥 트랜잭션이 커넥션 하나를 쥔 채 하나를 더 꺼낸다 — 동시 요청이 풀 크기에 닿으면
     * 전부가 서로를 막고 30 초 뒤 한꺼번에 500 이다. 기울기가 아니라 절벽이다.
     */
    @Test
    fun `요청 경로에 REQUIRES_NEW 가 없다`() {
        val users = sources().filter { (path, text) -> "REQUIRES_NEW" in text && ALLOWED_REQUIRES_NEW.none { it in path } }
        assertEquals(emptyList(), users.map { it.first }, "허용된 자리는 refresh 재사용 탐지뿐이다 — 그쪽은 돈이 아니다")
    }

    /** 락은 잡되 1 차 캐시에 이미 있으면 낡은 값을 준다 — 판정이 조용히 옛 값으로 돈다. */
    @Test
    fun `엔티티를 잠금 조회하지 않는다`() {
        val users = sources().filter { (_, text) -> "PESSIMISTIC_WRITE" in text }
        assertEquals(emptyList(), users.map { it.first }, "잠금 읽기는 값으로 한다 — 스칼라 for update 또는 조건부 UPDATE")
    }

    /** 지연 연관관계를 여는 것은 서비스의 일이다 — 컨트롤러가 열면 매핑이 트랜잭션 밖으로 샌다. */
    @Test
    fun `컨트롤러에 트랜잭션이 없다`() {
        val users = sources().filter { (path, text) -> path.endsWith("Controller.kt") && "@Transactional" in text }
        assertEquals(emptyList(), users.map { it.first }, "컨트롤러가 트랜잭션을 열면 그 경계가 화면 조립까지 늘어난다")
    }

    private fun sources(): List<Pair<String, String>> {
        val root = Path.of("src", "main", "kotlin")
        val all = root.walk().filter { it.extension == "kt" }.map { root.relativize(it).toString() to it.readText() }.toList()
        assertTrue(all.size > 30, "소스를 못 읽었다. 경로가 어긋나면 이 검사는 아무것도 지키지 않는다")
        return all
    }

    private fun sourcesOutside(pkg: String) = sources().filterNot { (path, _) -> path.contains("${pkg}${SEP}") }

    private companion object {
        val SEP: String = java.io.File.separator

        // AccountRepository 의 쓰기 메서드. 이름이 바뀌면 여기도 바뀌어야 한다 —
        // 안 바꾸면 검사가 조용히 아무것도 안 보게 된다.
        val BALANCE_WRITES = listOf("creditHolder", "debitHolder", "debitIssuance", "lockIssuance")
        val LEDGER_WRITES = listOf("journalEntryRepository.save", "postingRepository.save")
        val ALLOWED_REQUIRES_NEW = listOf("auth${SEP}")
    }
}

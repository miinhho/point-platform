package io.github.miinhho.point

import org.junit.jupiter.api.Test
import java.nio.file.Path
import kotlin.io.path.exists
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
    fun `잔액을 바꾸거나 잠그는 문장은 적용부에만 있다`() {
        val names = ledgerWriteNames()
        // 목록을 손으로 적으면 새 메서드가 생긴 날부터 검사가 조용히 안 본다 — 소스에서 뽑는다.
        assertTrue(names.size >= 5, "잔액을 바꾸거나 잠그는 메서드를 못 찾았다: $names")

        // 선언이 아니라 호출을 찾는다 — 리포지토리 자신은 그 이름을 갖고 있을 뿐이다.
        val callers = sourcesOutside("ledger").filter { (_, text) -> names.any { ".$it(" in text } }
        assertEquals(emptyList(), callers.map { it.first }, "적용부 밖에서 잔액을 바꾼다 — 락 순서와 전기가 그 자리를 안 지난다")
    }

    /**
     * **잠그는 메서드는 빠짐없이 검사 대상이어야 한다.** [ledgerWriteNames] 가 표 이름으로
     * 고르므로, 목록에 없는 표에 잠금이 생기면 그 자리가 조용히 검사 밖이 된다 — 파일
     * 이름을 박았던 것과 같은 모양이고 한 겹 위일 뿐이다.
     *
     * 새 잠금이 생기면 여기서 빨개진다. 그때 [LEDGER_TABLES] 에 그 표를 더하거나, 원장이
     * 지키는 것이 아니면 [SHOP_TABLES] 처럼 **왜 아닌지를 적고** 옮긴다.
     */
    @Test
    fun `잠그는 메서드가 검사 밖에 있지 않다`() {
        val locking = repositoryBlocks()
            .filter { block -> LOCKS.any { it in block } }
            .mapNotNull { Regex("\\bfun\\s+(\\w+)").find(it)?.groupValues?.get(1) }
        val watched = (ledgerWriteNames() + tableWriteNames(SHOP_TABLES)).toSet()
        assertEquals(emptyList(), locking - watched, "잠그는데 아무도 안 보는 메서드가 있다")
    }

    /**
     * **락 순서는 품목 행 → 원장 적용부다.** 적용부가 품목을 알면 반대 방향이 생기고, 두
     * 방향이 있으면 교착은 부하가 그만큼 오른 날에 처음 난다 — 그날은 되돌릴 곳이 없다.
     *
     * **패키지로 묻는다.** 클래스 이름 목록으로 물었더니 목록에 없는 이름(`PurchaseRepository`)
     * 이 그대로 통과했다 — 이름은 늘어나고 목록은 안 늘어난다. import 한 줄이면 이름이 몇 개
     * 생기든 걸리고, 원장의 낱말인 `JournalKind.PURCHASE` 는 import 가 아니라 안 걸린다.
     */
    @Test
    fun `적용부는 상점을 모른다`() {
        val leaked = sources().filter { (path, _) -> path.contains("ledger$SEP") }
            .filter { (_, text) -> SHOP_PACKAGE in text }
        assertEquals(emptyList(), leaked.map { it.first }, "적용부가 상점을 참조한다 — 락 순서가 두 방향이 됐다")
    }

    /**
     * 원장이 지키는 표를 **잠그거나 바꾸는** 메서드 전부. 읽기만 하는 것은 뺀다.
     *
     * 파일 이름도 메서드 이름도 박지 않는다 — 어느 쪽을 박아도 다른 자리에 잠금이 생긴 날
     * 그 자리가 검사 밖이다. 실제로 `point_types` 를 잠그는 것은 다른 리포지토리에 있다.
     * 고르는 기준은 **어느 표를 건드리는가** 하나다.
     */
    private fun ledgerWriteNames(): List<String> = tableWriteNames(LEDGER_TABLES)

    private fun tableWriteNames(tables: List<String>): List<String> =
        repositoryBlocks()
            .filter { block -> LOCKS_OR_WRITES.any { it in block } && tables.any { it in block } }
            .mapNotNull { Regex("\\bfun\\s+(\\w+)").find(it)?.groupValues?.get(1) }
            .distinct()

    /**
     * 리포지토리를 메서드 단위로 쪼개되 **주석은 걷는다.** 안 걷으면 「여기서는 `for update`
     * 를 쓰지 않는다」라고 적은 자리가 잠그는 것으로 세어진다 — 검사가 코드가 아니라 글을
     * 읽게 된다.
     */
    private fun repositoryBlocks(): List<String> =
        sources().filter { (path, _) -> path.endsWith("Repository.kt") }
            .flatMap { (_, text) ->
                text.lineSequence()
                    .filterNot { it.trimStart().let { line -> line.startsWith("//") || line.startsWith("*") || line.startsWith("/*") } }
                    .joinToString("\n").split("\n\n")
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

    /**
     * 락은 잡되 1 차 캐시에 이미 있으면 낡은 값을 준다 — 판정이 조용히 옛 값으로 돈다.
     * 읽기 락이든 쓰기 락이든 같으므로 `PESSIMISTIC_WRITE` 하나가 아니라 **잠그는 길 전부**를
     * 본다. 좁게 세면 검사가 이름만 남고 눈이 먼다.
     */
    @Test
    fun `엔티티를 잠금 조회하지 않는다`() {
        val users = sources().filter { (_, text) -> ENTITY_LOCKS.any { it in text } }
        assertEquals(emptyList(), users.map { it.first }, "잠금 읽기는 값으로 한다 — 스칼라 for update 또는 조건부 UPDATE")
    }

    /** 지연 연관관계를 여는 것은 서비스의 일이다 — 컨트롤러가 열면 매핑이 트랜잭션 밖으로 샌다. */
    @Test
    fun `컨트롤러에 트랜잭션이 없다`() {
        val users = sources().filter { (path, text) -> path.endsWith("Controller.kt") && "@Transactional" in text }
        assertEquals(emptyList(), users.map { it.first }, "컨트롤러가 트랜잭션을 열면 그 경계가 화면 조립까지 늘어난다")
    }

    /**
     * 규칙이 DB 를 모른다는 것은 주석이 아니라 **import 가 없다**는 사실이어야 한다. 하나라도
     * 들어오는 순간 규칙을 고치려면 판을 띄워야 하고, 그때부터 규칙은 어댑터로 스며든다.
     */
    @Test
    fun `규칙은 아무것도 import 하지 않는다`() {
        val leaked = PURE.map { it to text(it) }
            .filter { (_, text) -> text.lineSequence().any { it.startsWith("import ") } }
        assertEquals(emptyList(), leaked.map { it.first }, "규칙이 바깥을 알기 시작했다")
    }

    private fun text(relative: String): String {
        val path = Path.of("src", "main", "kotlin", "io", "github", "miinhho", "point", *relative.split("/").toTypedArray())
        assertTrue(path.exists(), "$relative 이 없다 — 경로가 어긋나면 이 검사는 아무것도 지키지 않는다")
        return path.readText()
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

        val LEDGER_WRITES = listOf("journalEntryRepository.save", "postingRepository.save")

        // @Lock 은 애너테이션, LockModeType 은 그 인자, entityManager.lock 은 직접 부르는 길.
        val ENTITY_LOCKS = listOf("LockModeType", "@Lock", "entityManager.lock")
        val LOCKS = listOf("for update", "for share")
        val LOCKS_OR_WRITES = listOf("@Modifying") + LOCKS

        // 원장이 지키는 표. 회원 자격도 refresh 도 원장 밖이라 여기 없다.
        val LEDGER_TABLES = listOf("accounts", "point_types")

        /**
         * 원장 밖에서 잠그는 표. 상점의 뮤텍스는 품목 행이고 그것은 잔액이 아니라 **약속**을
         * 지킨다 — 재고와 1 인 한도. 적용부에 넣으면 원장이 상점을 알게 되고 락 순서가 두
         * 방향이 된다(위 「적용부는 품목을 모른다」).
         */
        val SHOP_TABLES = listOf("listings", "vouchers")
        const val SHOP_PACKAGE: String = "import io.github.miinhho.point.shop."

        // DB 도 스프링도 모르는 자리. 늘어나면 여기 적는다 — 적지 않으면 검사를 안 받는다.
        val PURE = listOf(
            "ledger/Draft.kt", "ledger/Supply.kt", "ledger/JournalKind.kt", "ledger/AccountKind.kt",
            "shop/Stall.kt", "shop/Buyability.kt", "shop/Change.kt",
        )
        val ALLOWED_REQUIRES_NEW = listOf("auth${SEP}")
    }
}

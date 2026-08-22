package io.github.miinhho.point

import io.github.miinhho.point.ledger.Draft
import io.github.miinhho.point.ledger.JournalKind
import io.github.miinhho.point.ledger.Supply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * 원장의 규칙만 본다. **스프링도 DB 도 없다** — 규칙이 그것들을 모르기 때문이고, 모르는 것이
 * 이 설계의 값이다. 여기가 빨간데 판이 초록이면 규칙이 어딘가에 한 벌 더 있는 것이다.
 */
class LedgerRulesTest {
    @Test
    fun `발행 계정이 언제나 먼저 잠긴다`() {
        // 오름차순 하나가 규칙 둘을 대신한다 — 발행 계정은 holder_key 가 0 이라 맨 앞이다.
        val issue = Draft.issue(issuerKey = 7, amount = 1_000)
        assertEquals(listOf(Draft.ISSUANCE, 7L), issue.ordered.map { it.holderKey })
    }

    @Test
    fun `반대 방향 이체가 겹쳐도 같은 순서로 잠근다`() {
        val forward = Draft.transfer(fromKey = 3, toKey = 9, amount = 500).ordered.map { it.holderKey }
        val backward = Draft.transfer(fromKey = 9, toKey = 3, amount = 500).ordered.map { it.holderKey }
        assertEquals(forward, backward, "순서가 어긋나면 둘이 서로를 기다린다")
    }

    @Test
    fun `사건은 어디선가 나와 어디론가 간다`() {
        assertEquals(0, Draft.issue(issuerKey = 1, amount = 300).lines.sumOf { it.amount })
        assertEquals(0, Draft.transfer(fromKey = 1, toKey = 2, amount = 300).lines.sumOf { it.amount })
    }

    @Test
    fun `0 원 사건은 만들 수 없다`() {
        // 0 원 전기는 참여하지 않은 계정을 참여한 것처럼 보이게 한다.
        assertThrows<IllegalArgumentException> { Draft.transfer(fromKey = 1, toKey = 2, amount = 0) }
        assertThrows<IllegalArgumentException> { Draft.issue(issuerKey = 1, amount = 0) }
    }

    @Test
    fun `자기 자신에게 보내는 사건은 만들 수 없다`() {
        // 합은 0 이지만 한 계정을 두 번 건드린다 — 재계산과 내역 표시가 갈린다.
        assertThrows<IllegalArgumentException> { Draft.transfer(fromKey = 5, toKey = 5, amount = 100) }
    }

    @Test
    fun `발행 계정은 이체의 상대가 될 수 없다`() {
        assertThrows<IllegalArgumentException> { Draft.transfer(fromKey = Draft.ISSUANCE, toKey = 2, amount = 100) }
        assertThrows<IllegalArgumentException> { Draft.transfer(fromKey = 2, toKey = Draft.ISSUANCE, amount = 100) }
    }

    @Test
    fun `상한 변경은 전기가 없고 다른 사건은 전기가 있다`() {
        assertEquals(emptyList(), Draft.capChange().lines.map { it.holderKey })
        assertFalse(JournalKind.CAP_CHANGE.posts)
        assertTrue(JournalKind.entries.filter { it != JournalKind.CAP_CHANGE }.all { it.posts })
    }

    @Test
    fun `여유는 상한을 넘긴 뒤에도 음수로 보이지 않는다`() {
        // 상한을 낮추면 유통량이 상한을 넘은 상태가 될 수 있다 — 그때 음수를 실으면
        // 화면이 「마이너스만큼 발행할 수 있다」를 그린다.
        assertEquals(0, Supply(issued = 900, cap = 500).headroom)
        assertEquals(100, Supply(issued = 900, cap = 1_000).headroom)
    }

    @Test
    fun `여유가 꼭 한 번치면 그 한 번은 된다`() {
        val supply = Supply(issued = 970_000, cap = 1_000_000)
        assertTrue(supply.allows(30_000))
        assertFalse(supply.allows(30_001))
    }

    @Test
    fun `상한은 이미 발행한 양까지만 내려간다`() {
        val supply = Supply(issued = 500_000, cap = 1_000_000)
        assertTrue(supply.canLowerTo(500_000), "같은 값까지는 내려간다 — 상한이 뜻을 잃지 않는다")
        assertFalse(supply.canLowerTo(499_999))
    }
}

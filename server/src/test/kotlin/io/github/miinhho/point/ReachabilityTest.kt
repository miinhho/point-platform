package io.github.miinhho.point

import io.github.miinhho.point.membership.BankAccess
import io.github.miinhho.point.wallet.WalletService
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

/**
 * 지갑과 도달성은 다른 물음이지만 **한 방향으로 묶여 있다** — 담기면 반드시 닿는다.
 * 반대는 열려 있다: 초대만 받은 사람은 닿지만 안 담긴다.
 *
 * 판을 보지 않고 두 목록을 비교한다. 판을 보면 그 상태가 시드에 있어야만 걸리고, 경계가
 * 시드에서 빠지는 날 검사가 조용히 꺼진다.
 */
class ReachabilityTest {
    @Test
    fun `지갑이 담는 관계는 전부 은행에 닿는다`() {
        val carriedButUnreachable = WalletService.CARRIES - BankAccess.REACHES
        assertEquals(
            emptySet(),
            carriedButUnreachable,
            "지갑에 담기는데 은행에 못 닿는 관계가 있다 — 카드는 있고 페이지는 없다",
        )
    }

    /**
     * 집합은 순서 없는 것으로 읽히지만 `setOf` 는 적은 순서로 돌고 [BankAccess.canReach] 는
     * 첫 참에서 멈춘다. 알파벳순으로 정리하면 동작은 그대로인 채 공개 은행 조회가 조회 셋을
     * 더 한다 — 값만 늘고 아무 테스트도 안 빨개진다.
     */
    @Test
    fun `도달성은 조회 없는 관계부터 본다`() {
        val needsQuery = BankAccess.REACHES.map { it.needsQuery }
        assertEquals(
            needsQuery.sorted(),
            needsQuery,
            "REACHES 에 조회 드는 관계가 앞에 있다 — 싼 것으로 끝날 수 있는 은행이 조회를 한다",
        )
    }
}

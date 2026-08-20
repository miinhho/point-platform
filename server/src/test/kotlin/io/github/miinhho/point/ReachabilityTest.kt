package io.github.miinhho.point

import io.github.miinhho.point.pointtype.BankAccess
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
}

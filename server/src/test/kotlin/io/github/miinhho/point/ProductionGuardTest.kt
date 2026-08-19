package io.github.miinhho.point

import io.github.miinhho.point.auth.JwtProperties
import io.github.miinhho.point.shared.ProductionGuard
import org.junit.jupiter.api.Test
import org.springframework.boot.DefaultApplicationArguments
import org.springframework.mock.env.MockEnvironment
import java.time.Duration
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** 안 덮은 개발용 값으로 뜨면, 저장소에 공개된 키로 남의 잔액을 움직일 수 있다. */
class ProductionGuardTest {
    private val NoArgs = DefaultApplicationArguments()
    private val committed = "fTF8TbC5y7deokUmr/2fcTwdpZ93tmD4rW9kjTabTDoVcr0HGRAjfw4OP++kNdEu"

    @Test
    fun `공개된 서명 키와 시드가 남아 있으면 서지 않는다`() {
        val failure = assertFailsWith<IllegalStateException> { guard(committed, seed = true).run(NoArgs) }
        assertTrue(failure.message!!.contains("point.jwt.secret"), failure.message!!)
        assertTrue(failure.message!!.contains("point.seed-users"), failure.message!!)
    }

    @Test
    fun `덮었으면 그대로 뜬다`() {
        guard("bXktb3duLXNlY3JldC12YWx1ZS1ub3QtaW4tdGhlLXJlcG8tYXQtYWxs", seed = false).run(NoArgs)
    }

    private fun guard(secret: String, seed: Boolean) = ProductionGuard(
        JwtProperties(secret, Duration.ofMinutes(15), Duration.ofDays(14)),
        MockEnvironment().withProperty("point.seed-users", seed.toString()),
    )
}

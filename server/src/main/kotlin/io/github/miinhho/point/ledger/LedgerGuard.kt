package io.github.miinhho.point.ledger

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

/**
 * 원장이 스스로와 맞지 않으면 부팅을 막는다. 잔액이 틀린 채로 뜨면 그 위에서 일어나는
 * 이체가 전부 틀린 값을 나르고, 그때는 되돌릴 곳이 없다.
 *
 * 시드보다 늦게 돈다 — 시드가 만든 판도 같은 검사를 받아야 한다.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
class LedgerGuard(private val audit: LedgerAudit) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val broken = audit.check()
        check(broken.isEmpty()) { "원장이 스스로와 맞지 않는다: $broken" }
    }
}

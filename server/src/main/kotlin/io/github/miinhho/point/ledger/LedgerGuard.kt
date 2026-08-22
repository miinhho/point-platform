package io.github.miinhho.point.ledger

import org.slf4j.LoggerFactory
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
    private val log = LoggerFactory.getLogger(javaClass)

    override fun run(args: ApplicationArguments) {
        // 고치는 것은 사람이 시킬 때만 한다 — 조용히 고치면 틀어진 적이 있다는 것을 아무도 모른다.
        if (args.containsOption(RECOMPUTE)) {
            log.warn("잔액을 전기에서 다시 접는다 — 고친 계정 {}", audit.recompute())
        }
        // 지표로 내보내지 않는다 — 여기서 터지면 프로세스가 없고, 안 터지면 값이 늘 0 이다.
        // 값이 하나뿐인 게이지는 긁을 수 있는 상태가 「0 과 안 옴」뿐이고 그 둘은 `up` 이 이미 말한다.
        val broken = audit.check()
        check(broken.isEmpty()) { "원장이 스스로와 맞지 않는다: $broken" }
    }

    private companion object {
        // java -jar point.jar --ledger.recompute
        const val RECOMPUTE = "ledger.recompute"
    }
}

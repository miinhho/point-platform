package io.github.miinhho.point.ledger

import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component

/**
 * 원장이 스스로와 맞는지를 **지표로 낸다.** 앱은 사실만 내고 「그래서 무엇을 할 것인가」는
 * 밖에서 정한다 — 주기 검사를 앱에 두면 「틀어졌을 때 무엇을 하는가」를 앱이 정해야 하고,
 * 로그로 남기면 아무도 안 본다.
 *
 * 셋 다 0 이어야 한다. 0 이 아닌 순간이 알림이다 (docs/LEDGER.md 5 단계).
 *
 * 부팅 검사([LedgerGuard])는 그대로 둔다 — 틀어진 채로 뜨는 것은 알리는 것이 아니라 막는다.
 */
@Component
class LedgerMetrics(registry: MeterRegistry, private val audit: LedgerAudit) {
    init {
        // 스크레이프마다 센다. 표 셋을 훑으므로 스크레이프 주기를 초 단위로 두지 않는다.
        registry.gauge("ledger.entries.out_of_balance", this) { it.audit.entriesOutOfBalance().toDouble() }
        registry.gauge("ledger.point_types.out_of_balance", this) { it.audit.pointTypesOutOfBalance().toDouble() }
        registry.gauge("ledger.accounts.drifted", this) { it.audit.driftedAccounts().toDouble() }
    }
}

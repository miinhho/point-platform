package io.github.miinhho.point.ledger

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager

/**
 * 원장이 낸 사실을 **사건이 일어난 자리에서** 센다. 스크레이프마다 표를 훑지 않는다 —
 * 아무 일도 없는 15 초마다 전기 표를 세 번 훑게 되고, 긁는 주기를 줄일수록 비싸진다.
 *
 * **대사는 여기서 하지 않는다.** 잔액과 전기는 같은 트랜잭션에서 같은 값으로 쓰이므로
 * 적용부가 도는 한 갈릴 수 없다. 대사는 부팅([LedgerGuard])과 사람이 시키는 재계산의 일이다.
 *
 * Counter 는 프로세스가 죽으면 아무것도 안 나간다 — 알림에 `absent()` 를 함께 건다
 * (docs/REBUILD.md).
 */
@Component
class LedgerMetrics(registry: MeterRegistry) {
    private val events = JournalKind.entries.associateWith { kind ->
        Counter.builder("ledger.events").tag("kind", kind.name).description("적용한 사건 수").register(registry)
    }

    private val postings = Counter.builder("ledger.postings")
        .description("남긴 전기 수").register(registry)

    /**
     * **커밋된 것만 센다.** 적용부 안에서 바로 올리면 롤백한 것도 남아, 같은 키 경합과
     * 교착이 나는 만큼 이 수가 `journal_entries` 의 행 수를 웃돈다 — 그 둘을 나란히 놓고
     * 대사하려는 사람이 나오는 순간 없는 어긋남을 보게 된다. 실측 교착률이 5% 였다.
     */
    fun applied(kind: JournalKind, lines: Int) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return count(kind, lines)
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCommit() = count(kind, lines)
            },
        )
    }

    private fun count(kind: JournalKind, lines: Int) {
        events.getValue(kind).increment()
        postings.increment(lines.toDouble())
    }
}

package io.github.miinhho.point.ledger

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicInteger

/**
 * 원장이 낸 사실을 **사건이 일어난 자리에서** 센다. 스크레이프마다 표를 훑지 않는다 —
 * 아무 일도 없는 15 초마다 전기 표를 세 번 훑게 되고, 긁는 주기를 줄일수록 비싸진다.
 *
 * **대사는 여기서 하지 않는다.** 잔액과 전기는 같은 트랜잭션에서 같은 값으로 쓰이므로
 * 적용부가 도는 한 갈릴 수 없고, 갈린다면 그것은 적용부 밖에서 손댄 것이라 사건이 없다.
 * 그래서 대사는 부팅([LedgerGuard])과 사람이 시키는 재계산의 일이고, 여기서는 **부팅 때
 * 잰 값을 그대로 들고 있는다.**
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

    private val brokenAtBoot = registry.gauge("ledger.broken_at_boot", AtomicInteger(0))!!

    fun applied(kind: JournalKind, lines: Int) {
        events.getValue(kind).increment()
        postings.increment(lines.toDouble())
    }

    /** 부팅 검사가 잰 값. 뜬 뒤에는 안 바뀐다 — 뜬 뒤에 틀어지려면 적용부 밖에서 손대야 한다. */
    fun bootChecked(broken: Int) = brokenAtBoot.set(broken)
}

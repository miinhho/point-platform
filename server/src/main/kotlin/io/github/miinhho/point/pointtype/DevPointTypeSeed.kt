package io.github.miinhho.point.pointtype

import io.github.miinhho.point.user.UserRepository
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

/**
 * 같은 이름의 포인트 둘이 들어 있는 이유가 이 시드의 전부다. `PointType.nameIsShared` 를
 * 실기동에서 확인하려면 겹치는 이름이 있어야 하는데, 겹침은 사람이 만들기 전에는 생기지
 * 않는다 — 사용자 시드와 같은 이유다 (`DevUserSeed`).
 *
 * 창설 서비스를 지난다. 손으로 행을 넣으면 화면이 만들 수 없는 은행이 판에 남는다 —
 * 실제로 허용 목록에 없는 이모지로 둘이 서 있었고, QA 는 API 가 거절하는 은행을 보고 있었다.
 */
@Component
@Order(1)
@ConditionalOnProperty("point.seed-users", havingValue = "true")
class DevPointTypeSeed(
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val pointTypeCreateService: PointTypeCreateService,
) : ApplicationRunner {
    // 발행자 핸들을 읽는다 — open-in-view=false 라 트랜잭션 밖이면 프록시가 열리지 않는다.
    @Transactional(readOnly = true)
    fun missing(): List<Seed> {
        val existing = pointTypeRepository.findAll().map { it.name to it.issuer.handle }.toSet()
        return SEED.filterNot { it.name to it.handle in existing }
    }

    override fun run(args: ApplicationArguments) {
        // 창설은 트랜잭션을 스스로 연다. 바깥에 하나 더 두면 발행 계정 삽입이 은행 행의
        // FK 락을 기다리고 바깥은 그 삽입을 기다린다.
        for (seed in missing()) {
            val issuer = userRepository.findByHandle(seed.handle) ?: continue
            pointTypeCreateService.create(
                issuer.id!!,
                "seed-${seed.handle}",
                CreatePointTypeRequest(
                    name = seed.name,
                    emoji = seed.emoji,
                    description = null,
                    accent = seed.accent.name.lowercase(),
                    issueCap = BigDecimal(1_000_000),
                    visibility = "public",
                ),
            )
        }
    }

    data class Seed(val name: String, val emoji: String, val handle: String, val accent: PointAccent)

    private companion object {
        // 이름이 같고 발행자가 다르다. 가르는 것은 발행자 핸들뿐이다 (docs/JOURNEY.md 여정 2).
        val SEED = listOf(
            Seed("온포인트", "🏪", "@onmart", PointAccent.BLUE),
            Seed("온포인트", "🌸", "@jisoo", PointAccent.PURPLE),
        )
    }
}

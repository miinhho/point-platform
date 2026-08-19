package io.github.miinhho.point.pointtype

import io.github.miinhho.point.user.UserRepository
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

/**
 * 같은 이름의 포인트 둘이 들어 있는 이유가 이 시드의 전부다. `PointType.nameIsShared` 를
 * 실기동에서 확인하려면 원장에 겹치는 이름이 있어야 하는데, 겹침은 사람이 만들기 전에는
 * 생기지 않는다 — 사용자 시드와 같은 이유다 (`DevUserSeed`).
 *
 * 창설 엔드포인트를 대신하지 않는다. 이름이 겹치는 둘만 채운다.
 */
@Component
@Order(1)
@ConditionalOnProperty("point.seed-users", havingValue = "true")
class DevPointTypeSeed(
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
) : ApplicationRunner {
    // 발행자 핸들을 읽는다 — open-in-view=false 라 트랜잭션 밖이면 프록시가 열리지 않는다.
    @Transactional
    override fun run(args: ApplicationArguments) {
        val existing = pointTypeRepository.findAll().map { it.name to it.issuer.handle }.toSet()
        val created = SEED.mapNotNull { (name, emoji, handle, accent) ->
            if (name to handle in existing) return@mapNotNull null
            val issuer = userRepository.findByHandle(handle) ?: return@mapNotNull null
            PointType(
                name = name,
                emoji = emoji,
                issuer = issuer,
                accent = accent,
                visibility = PointVisibility.PUBLIC,
                issueCap = 1_000_000,
                totalIssued = 0,
            )
        }
        if (created.isNotEmpty()) pointTypeRepository.saveAll(created)
    }

    private companion object {
        // 이름이 같고 발행자가 다르다. 가르는 것은 발행자 핸들뿐이다 (docs/JOURNEY.md 여정 2).
        val SEED = listOf(
            Quad("온포인트", "🔵", "@onmart", PointAccent.BLUE),
            Quad("온포인트", "🟣", "@jisoo", PointAccent.PURPLE),
        )
    }
}

private data class Quad(val name: String, val emoji: String, val handle: String, val accent: PointAccent)

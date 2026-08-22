package io.github.miinhho.point.shared

import io.github.miinhho.point.auth.JwtProperties
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.env.Environment
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

/**
 * 개발용 기본값을 안 덮은 채로는 뜨지 않는다.
 *
 * `application.properties` 의 서명 키는 저장소에 공개돼 있다 — 안 덮으면 누구나 임의
 * `userId` 로 access 토큰을 만들 수 있고, 그 토큰으로 부른 이체는 **실제로 남의 잔액을
 * 움직인다.** 이 앱에는 되돌리기가 없다. 시드 계정의 암호도 공개된 값이다.
 *
 * 로그인 시도 제한은 앱이 아니라 앞단에 있다 (`docs/REBUILD.md`). 앱에서 세면 「성공하면
 * 지운다」가 따라오고 그 자리가 구멍이었다 — 계정 하나로 자기 회선 기록을 계속 비울 수 있다.
 *
 * 이런 것은 「틀리면 요란한」 쪽이 아니라 「틀려도 조용한」 쪽이라 배포하는 날 알아차릴
 * 계기가 없다. 그래서 부팅에서 세운다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty("point.dev-defaults", havingValue = "false")
class ProductionGuard(
    private val jwtProperties: JwtProperties,
    private val environment: Environment,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val wrong = buildList {
            if (jwtProperties.secret == COMMITTED_DEV_SECRET) add("point.jwt.secret 이 저장소에 공개된 개발용 값이다")
            if (environment.getProperty("point.seed-users", Boolean::class.java, false)) {
                add("point.seed-users 가 켜져 있다 — 암호가 공개된 계정이 생긴다")
            }
            // 시도 제한을 앱 밖에 두기로 했으면 그 방어 없이 뜨면 안 된다.
            // 「나중에 붙이기로 했다」로 남은 것은 붙지 않는다.
            if (!environment.getProperty("point.login-rate-limited-upstream", Boolean::class.java, false)) {
                add("앞단에 /api/auth/login 요청 수 제한이 없다 — 있으면 point.login-rate-limited-upstream=true")
            }
        }
        check(wrong.isEmpty()) { "개발용 기본값을 덮지 않았다: $wrong" }
    }

    private companion object {
        const val COMMITTED_DEV_SECRET = "fTF8TbC5y7deokUmr/2fcTwdpZ93tmD4rW9kjTabTDoVcr0HGRAjfw4OP++kNdEu"
    }
}

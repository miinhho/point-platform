package io.github.miinhho.point.user

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component

/**
 * 실기동에서 쓸 계정을 채운다. **가입 엔드포인트를 여는 것이 아니다** — 가입은 제공자
 * 로그인과 함께 온다 (`docs/REBUILD.md`).
 *
 * 같은 이름 둘이 들어 있는 이유가 이 시드의 전부다. 계정을 만들 길이 없으면 동명이인을
 * 만들 수 없고, 그러면 `nameIsShared` 방어를 실서버에서 확인할 방법이 없다.
 */
@Component
@ConditionalOnProperty("point.seed-users", havingValue = "true")
class DevUserSeed(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val missing = SEED.filter { (handle, _) -> userRepository.findByHandle(handle) == null }
        if (missing.isEmpty()) return

        val hash = passwordEncoder.encode(PASSWORD)!!
        userRepository.saveAll(missing.map { (handle, name) -> User(name = name, handle = handle, passwordHash = hash) })
    }

    private companion object {
        const val PASSWORD = "point"

        // @jisoo 와 @jisu 가 같은 이름이다. 핸들만이 둘을 가른다.
        val SEED = listOf(
            "@minho" to "장민호",
            "@onmart" to "온마트",
            "@jisoo" to "김지수",
            "@jisu" to "김지수",
            "@nara" to "이나라",
            "@mose" to "정모세",
        )
    }
}

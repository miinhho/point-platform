package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.TestRestTemplate
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 계약: docs/API.md 「실패」 — 오류 본문에 **예외가 없다.**
 *
 * `code` 도 `outcome` 도 없는 본문이 새면 화면은 그것을 「결과를 알 수 없다」로 읽고,
 * 아무 일도 일어나지 않은 요청을 두고 돈이 어디 있는지 모른다고 말하게 된다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class FailureBodyTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    lateinit var me: User

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()
        me = userRepository.save(User(name = "김지수", handle = "@jisoo", passwordHash = passwordEncoder.encode("point")!!))
    }

    @Test
    fun `핸들러가 없는 경로도 계약 본문으로 답한다`() {
        // 구현 중에 제일 자주 나는 자리다 — 아직 없는 엔드포인트를 프론트가 부른다.
        val paths = listOf(
            "/api/nope",
            "/api/invites",
            "/api/point-types/00000000-0000-0000-0000-000000000000/invites",
        )
        paths.forEach { path ->
            val body = assertNotNull(get(path).body, path)
            assertTrue(
                body.contains("\"code\":\"UNKNOWN_ENDPOINT\""),
                "고칠 입력이 없으므로 MALFORMED_REQUEST 가 아니다 — $path: $body",
            )
            assertTrue(body.contains("\"outcome\":\"none\""), "아무 일도 없었다고 단정해야 한다 — $path: $body")
            assertTrue(!body.contains("\"error\":"), "프레임워크 기본 본문이 새면 안 된다 — $path: $body")
        }
    }

    @Test
    fun `허용되지 않는 메서드도 같은 본문이다`() {
        val body = assertNotNull(
            restTemplate.exchange("/api/me", HttpMethod.DELETE, HttpEntity<Void>(auth()), String::class.java).body,
        )
        assertTrue(body.contains("\"outcome\":\"none\""), body)
    }

    @Test
    fun `토큰이 없으면 여전히 UNAUTHENTICATED 다`() {
        // 없는 경로를 계약 본문으로 답하게 만들면서 인증 응답을 덮지 않았는지 본다.
        val body = assertNotNull(restTemplate.getForEntity("/api/nope", String::class.java).body)
        assertTrue(body.contains("\"code\":\"UNAUTHENTICATED\""), body)
    }

    private fun get(path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.GET, HttpEntity<Void>(auth()), String::class.java)

    private fun auth() = HttpHeaders().apply {
        setBearerAuth(
            assertNotNull(
                restTemplate.postForEntity("/api/auth/login", LoginRequest("@jisoo", "point"), LoginResponse::class.java).body,
            ).accessToken,
        )
    }
}

package io.github.miinhho.point.auth

import io.github.miinhho.point.TestcontainersConfiguration
import io.github.miinhho.point.domain.auth.RefreshTokenRepository
import io.github.miinhho.point.domain.user.User
import io.github.miinhho.point.domain.user.UserRepository
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
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class AuthIntegrationTest {
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var refreshTokenRepository: RefreshTokenRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    @BeforeEach
    fun seedUser() {
        refreshTokenRepository.deleteAll()
        userRepository.deleteAll()
        userRepository.save(User(name = "김지수", handle = "@jisoo", passwordHash = passwordEncoder.encode("point")!!))
    }

    @Test
    fun `핸들과 암호가 맞으면 access refresh 토큰과 user 를 돌려준다`() {
        val response = restTemplate.postForEntity(
            "/api/auth/login",
            LoginRequest("@jisoo", "point"),
            LoginResponse::class.java,
        )

        assertEquals(HttpStatus.OK, response.statusCode)
        val body = assertNotNull(response.body)
        assertNotNull(body.accessToken)
        assertNotNull(body.refreshToken)
        assertEquals("@jisoo", body.user.handle)
    }

    @Test
    fun `핸들 표기가 흔들려도 서버가 정규화해 같은 사람으로 본다`() {
        for (variant in listOf("jisoo", "JISOO", "@@jisoo", "  @Jisoo  ")) {
            val response = restTemplate.postForEntity(
                "/api/auth/login",
                LoginRequest(variant, "point"),
                LoginResponse::class.java,
            )
            assertEquals(HttpStatus.OK, response.statusCode, "handle=$variant")
            assertEquals("@jisoo", assertNotNull(response.body).user.handle)
        }
    }

    @Test
    fun `암호가 틀리면 401 BAD_CREDENTIALS`() {
        val response = restTemplate.postForEntity(
            "/api/auth/login",
            LoginRequest("@jisoo", "wrong"),
            FailureResponse::class.java,
        )

        assertEquals(HttpStatus.UNAUTHORIZED, response.statusCode)
        assertEquals("BAD_CREDENTIALS", response.body?.code)
    }

    @Test
    fun `토큰 없이 보호된 경로는 401 UNAUTHENTICATED, access 토큰이 있으면 통과한다`() {
        val withoutToken = restTemplate.postForEntity("/api/protected-probe", null, FailureResponse::class.java)
        assertEquals(HttpStatus.UNAUTHORIZED, withoutToken.statusCode)
        assertEquals("UNAUTHENTICATED", withoutToken.body?.code)

        val login = login()
        val headers = HttpHeaders().apply { setBearerAuth(login.accessToken) }
        // 매핑된 컨트롤러가 없으니 인증을 통과하면 404, 통과 못 하면 401 이다.
        // 404 본문은 { code } 모양이 아니라 Boot 기본 에러 바디라 상태 코드만 본다.
        val withToken = restTemplate.exchange(
            "/api/protected-probe",
            HttpMethod.POST,
            HttpEntity<Void>(headers),
            String::class.java,
        )
        assertEquals(HttpStatus.NOT_FOUND, withToken.statusCode)
    }

    @Test
    fun `refresh 는 회전된 새 토큰 쌍을 돌려주고, 옛 토큰은 재사용하면 사슬 전체가 무효화된다`() {
        val login = login()

        val rotated = restTemplate.postForEntity(
            "/api/auth/refresh",
            RefreshRequest(login.refreshToken),
            TokenPairResponse::class.java,
        )
        assertEquals(HttpStatus.OK, rotated.statusCode)
        val rotatedBody = assertNotNull(rotated.body)
        // access 는 같은 초에 발급되면 클레임(sub·iat·exp)이 같아 서명까지 동일할 수 있다 — 비교 대상이 아니다.
        assertNotEquals(login.refreshToken, rotatedBody.refreshToken)

        // 이미 회전으로 폐기된 옛 토큰 재사용 — 탈취로 간주하고 사슬 전체를 revoke 한다.
        val reuse = restTemplate.postForEntity(
            "/api/auth/refresh",
            RefreshRequest(login.refreshToken),
            FailureResponse::class.java,
        )
        assertEquals(HttpStatus.UNAUTHORIZED, reuse.statusCode)
        assertEquals("UNAUTHENTICATED", reuse.body?.code)

        // 방금 정상 발급된 최신 토큰도 같은 사슬이라 함께 무효화됐어야 한다.
        val afterReuse = restTemplate.postForEntity(
            "/api/auth/refresh",
            RefreshRequest(rotatedBody.refreshToken),
            FailureResponse::class.java,
        )
        assertEquals(HttpStatus.UNAUTHORIZED, afterReuse.statusCode)
        assertEquals("UNAUTHENTICATED", afterReuse.body?.code)
    }

    @Test
    fun `logout 뒤에는 같은 refresh 토큰으로 재발급받을 수 없다`() {
        val login = login()

        val logout = restTemplate.postForEntity(
            "/api/auth/logout",
            LogoutRequest(login.refreshToken),
            Void::class.java,
        )
        assertEquals(HttpStatus.NO_CONTENT, logout.statusCode)

        val afterLogout = restTemplate.postForEntity(
            "/api/auth/refresh",
            RefreshRequest(login.refreshToken),
            FailureResponse::class.java,
        )
        assertEquals(HttpStatus.UNAUTHORIZED, afterLogout.statusCode)
    }

    private fun login(): LoginResponse =
        assertNotNull(
            restTemplate.postForEntity("/api/auth/login", LoginRequest("@jisoo", "point"), LoginResponse::class.java).body,
        )
}

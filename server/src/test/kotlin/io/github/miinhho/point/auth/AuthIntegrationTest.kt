package io.github.miinhho.point.auth

import io.github.miinhho.point.LedgerReset
import io.github.miinhho.point.TestcontainersConfiguration
import io.github.miinhho.point.shared.FailureResponse
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.transfer.TransferRepository
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
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class AuthIntegrationTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var refreshTokenRepository: RefreshTokenRepository
    @Autowired lateinit var transferRepository: TransferRepository
    @Autowired lateinit var accountRepository: AccountRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder
    @Autowired lateinit var passwordCheck: PasswordCheck

    @Test
    fun `없는 핸들에 돌리는 해시가 실제 것과 같은 비용이다`() {
        // 비용이 갈리면 응답 시간이 갈리고, 그것 하나로 핸들의 존재가 샌다.
        // 상수로 박혀 있던 것이 cost 12 였고 실제는 10 이라 없는 핸들이 3.7 배 느렸다.
        assertEquals(costOf(passwordEncoder.encode("point")!!), costOf(passwordCheck.absentHandleHash))
    }

    // BCrypt 해시는 $2a$10$... 꼴이고 셋째 칸이 cost 다.
    private fun costOf(hash: String) = hash.split("$")[2].toInt()

    @BeforeEach
    fun seedUser() {
        ledgerReset.wipe()
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
    fun `같은 refresh 토큰으로 동시에 회전을 시도하면 하나만 이기고 나머지는 사슬째 죽는다`() {
        val login = login()
        val pool = Executors.newFixedThreadPool(2)
        val ready = CountDownLatch(2)
        val go = CountDownLatch(1)

        val calls = List(2) {
            pool.submit<org.springframework.http.HttpStatusCode> {
                ready.countDown()
                go.await()
                // 승자는 TokenPairResponse, 패자는 FailureResponse 모양이라 상태 코드만 본다.
                restTemplate.postForEntity(
                    "/api/auth/refresh",
                    RefreshRequest(login.refreshToken),
                    String::class.java,
                ).statusCode
            }
        }
        assertTrue(ready.await(5, TimeUnit.SECONDS))
        go.countDown()
        val results = calls.map { it.get(10, TimeUnit.SECONDS) }
        pool.shutdown()

        assertEquals(1, results.count { it == HttpStatus.OK }, "정확히 하나만 회전에 성공해야 한다")
        assertEquals(1, results.count { it == HttpStatus.UNAUTHORIZED })
    }

    private fun login(handle: String, password: String) =
        restTemplate.postForEntity("/api/auth/login", LoginRequest(handle, password), String::class.java)

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

package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.auth.RefreshTokenRepository
import io.github.miinhho.point.ledger.Account
import io.github.miinhho.point.ledger.AccountKind
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
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
import org.springframework.security.crypto.password.PasswordEncoder
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 계약: docs/API.md — nameIsShared 는 「원장 전체에서」 센다.
 *
 * 응답에 담긴 목록에서 세면 겹치는 둘 중 하나만 담긴 응답에서 방어가 조용히 꺼진다.
 * 그 자리를 재현하는 것이 이 테스트의 전부다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class NameIsSharedTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var bankFixture: BankFixture
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var accountRepository: AccountRepository
    @Autowired lateinit var transferRepository: TransferRepository
    @Autowired lateinit var refreshTokenRepository: RefreshTokenRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()

        val onmart = save("@onmart", "온마트")
        val solcafe = save("@solcafe", "솔카페")
        val jisoo = save("@jisoo", "김지수")
        save("@jisu", "김지수")
        save("@taeyun", "박태윤")

        // 이름이 겹치는 포인트 둘. jisoo 는 그중 한쪽만 가진다.
        val onFromOnmart = bankFixture.open(point("온포인트", "🏪", onmart, PointAccent.BLUE))
        bankFixture.open(point("온포인트", "🌸", solcafe, PointAccent.TEAL))
        bankFixture.open(point("솔포인트", "☀️", solcafe, PointAccent.GREEN))

        accountRepository.save(Account(pointType = onFromOnmart, user = jisoo, kind = AccountKind.HOLDER, balance = 812_000))
    }

    @Test
    fun `한쪽만 가진 사용자의 지갑에도 nameIsShared 가 참으로 온다`() {
        val body = assertNotNull(get("/api/wallet"))

        // 지갑에는 온포인트가 하나만 담긴다 — 여기서 세면 "겹치지 않는다"가 된다.
        assertEquals(1, Regex("\"name\":\"온포인트\"").findAll(body).count(), "지갑에 온포인트는 하나만 담긴다")
        val onEntry = assertNotNull(Regex("\\{\"id\":\"[^\"]+\",\"name\":\"온포인트\".*?\\}").find(body)).value
        assertTrue(onEntry.contains("\"nameIsShared\":true"), "원장에 둘이므로 참이어야 한다: $onEntry")
    }

    @Test
    fun `겹치지 않는 이름은 거짓이다`() {
        val body = assertNotNull(get("/api/point-types"))
        val sol = assertNotNull(Regex("\\{\"id\":\"[^\"]+\",\"name\":\"솔포인트\".*?\\}").find(body)).value
        assertTrue(sol.contains("\"nameIsShared\":false"), "솔포인트는 하나뿐이다: $sol")
    }

    @Test
    fun `사용자 겹침도 원장 전체에서 센다 — 핸들로 한 명만 찾아도 참이다`() {
        // 요청자(@jisoo)는 자기 검색 결과에서 빠지므로 김지수가 하나만 담긴다.
        // 응답 안에서 세면 "겹치지 않는다"가 되는 자리이고, 그래도 참이어야 한다.
        val body = assertNotNull(get("/api/users?q=@jisu"))
        assertEquals(1, Regex("\"name\":\"김지수\"").findAll(body).count(), "응답에는 김지수가 하나만 담긴다: $body")
        assertTrue(body.contains("\"handle\":\"@jisu\",\"nameIsShared\":true"), "원장에 둘이므로 참이어야 한다: $body")

        val alone = assertNotNull(get("/api/users?q=taeyun"))
        assertTrue(alone.contains("\"nameIsShared\":false"), "박태윤은 하나뿐이다: $alone")
    }

    @Test
    fun `me 와 login 응답에도 실린다`() {
        assertTrue(assertNotNull(get("/api/me")).contains("\"nameIsShared\":true"))
        val login = restTemplate.postForEntity("/api/auth/login", LoginRequest("@jisoo", "point"), String::class.java)
        assertTrue(assertNotNull(login.body).contains("\"nameIsShared\":true"), "로그인 응답의 user 에도 실린다")
    }

    private fun get(path: String): String? {
        val headers = HttpHeaders().apply { setBearerAuth(login().accessToken) }
        return restTemplate.exchange(path, HttpMethod.GET, HttpEntity<Void>(headers), String::class.java).body
    }

    private fun login(): LoginResponse =
        assertNotNull(restTemplate.postForEntity("/api/auth/login", LoginRequest("@jisoo", "point"), LoginResponse::class.java).body)

    private fun save(handle: String, name: String) =
        userRepository.save(User(name = name, handle = handle, passwordHash = passwordEncoder.encode("point")!!))

    private fun point(name: String, emoji: String, issuer: User, accent: PointAccent) =
        PointType(name = name, emoji = emoji, issuer = issuer, accent = accent,
            visibility = PointVisibility.PUBLIC, issueCap = 1_000_000, totalIssued = 0)
}

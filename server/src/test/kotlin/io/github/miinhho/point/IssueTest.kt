package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.issue.IssueRequest
import io.github.miinhho.point.transfer.TransferRequest
import io.github.miinhho.point.pointtype.ChangeCapRequest
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
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
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import java.math.BigDecimal
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 계약: docs/API.md 「발행은 이체가 아니다」.
 *
 * `totalIssuedAfter` 와 `issueCapAt` 이 이 테스트의 중심이다 — 일어난 일은 일어난 때의
 * 값을 갖는다. 지금 값에서 거꾸로 계산할 수 없다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class IssueTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    lateinit var issuer: User
    lateinit var other: User
    lateinit var point: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()
        issuer = save("@onmart", "온마트")
        other = save("@jisoo", "김지수")
        point = pointTypeRepository.save(
            PointType(
                name = "온포인트",
                emoji = "🔵",
                issuer = issuer,
                accent = PointAccent.BLUE,
                visibility = PointVisibility.PUBLIC,
                issueCap = 1_000_000,
                totalIssued = 0,
            ),
        )
    }

    @Test
    fun `발행은 그때의 유통량과 상한을 갖는다`() {
        val first = issue(50_000)
        assertEquals(HttpStatus.CREATED, first.statusCode, first.body)
        assertTrue(assertNotNull(first.body).contains("\"totalIssuedAfter\":50000"), first.body)
        assertTrue(assertNotNull(first.body).contains("\"issueCapAt\":1000000"), first.body)
        val firstId = idOf(assertNotNull(first.body))

        // 두 번째는 누적이라 금액과 다르다 — 첫 발행만 보면 둘이 같아 구별되지 않는다.
        val second = issue(30_000)
        assertTrue(assertNotNull(second.body).contains("\"totalIssuedAfter\":80000"), "누적이다: ${second.body}")
        assertTrue(assertNotNull(second.body).contains("\"amount\":30000"), second.body)

        patch("/api/point-types/${point.publicId}/cap", ChangeCapRequest(BigDecimal(5_000_000)))

        val again = assertNotNull(get(issuer, "/api/issues/$firstId").body)
        assertTrue(again.contains("\"totalIssuedAfter\":50000"), "지난 발행에 오늘 유통량이 뜨면 안 된다: $again")
        assertTrue(again.contains("\"issueCapAt\":1000000"), "상한이 바뀌어도 그때 값이다: $again")
    }

    @Test
    fun `발행 응답에는 이체의 칸이 없다`() {
        val body = assertNotNull(issue(1_000).body)
        listOf("kind", "toId", "fromId", "counterparty").forEach {
            assertTrue(!body.contains("\"$it\""), "$it 은 이체의 칸이다: $body")
        }
        assertTrue(body.contains("\"issuerId\":"), "발행자가 곧 받는 사람이라 칸이 하나다: $body")
    }

    @Test
    fun `대상이 실려 오면 거절한다`() {
        val response = post(
            issuer,
            "/api/issues",
            IssueRequest(pointTypeId = point.publicId.toString(), amount = BigDecimal(1_000), toId = publicId(other)),
        )
        assertEquals(HttpStatus.BAD_REQUEST, response.statusCode, response.body)
        assertTrue(assertNotNull(response.body).contains("toId"), "조용히 무시하면 잘못 고른 것을 알 방법이 없다")
    }

    @Test
    fun `발행은 발행자만 하고 남의 발행은 읽지 못한다`() {
        val mine = idOf(assertNotNull(issue(1_000).body))

        val theirs = post(other, "/api/issues", IssueRequest(point.publicId.toString(), BigDecimal(1_000)))
        assertEquals(HttpStatus.FORBIDDEN, theirs.statusCode, theirs.body)

        val peek = get(other, "/api/issues/$mine")
        assertEquals(HttpStatus.NOT_FOUND, peek.statusCode, "남의 것은 없는 것과 같다: ${peek.body}")
    }

    @Test
    fun `같은 키로 다시 보내면 두 번 발행되지 않는다`() {
        val key = UUID.randomUUID().toString()
        val first = post(issuer, "/api/issues", IssueRequest(point.publicId.toString(), BigDecimal(1_000)), key)
        val again = post(issuer, "/api/issues", IssueRequest(point.publicId.toString(), BigDecimal(1_000)), key)

        assertEquals(HttpStatus.CREATED, first.statusCode)
        assertEquals(HttpStatus.OK, again.statusCode, "다시 만들지 않고 그때 것을 준다")
        assertEquals(first.body, again.body)

        val byKey = assertNotNull(get(issuer, "/api/issues/by-key?idempotencyKey=$key").body)
        assertEquals(first.body, byKey)
        assertEquals("null", assertNotNull(get(issuer, "/api/issues/by-key?idempotencyKey=${UUID.randomUUID()}").body))
    }

    @Test
    fun `내역에 발행이 자기 종류로 실린다`() {
        issue(1_000)
        val history = assertNotNull(get(issuer, "/api/history").body)
        assertTrue(history.contains("\"type\":\"issue\""), history)
        assertTrue(history.contains("\"issue\":{"), history)
    }

    @Test
    fun `지갑에서 빠진 포인트의 내역 줄도 표기를 갖는다`() {
        issue(1_000)
        // 전액 보내면 그 순간 지갑에서 빠진다 — 클라이언트가 지갑에서 찾으면 이 줄이 빈다.
        assertEquals(
            HttpStatus.CREATED,
            post(
                issuer,
                "/api/transfers",
                TransferRequest(point.publicId.toString(), publicId(other), BigDecimal(1_000)),
            ).statusCode,
        )
        assertTrue(assertNotNull(get(issuer, "/api/wallet").body).let { !it.contains("\"name\":\"온포인트\"") } ||
            assertNotNull(get(issuer, "/api/wallet").body).contains("\"amount\":0"), "지갑에서 빠지거나 0 이다")

        val history = assertNotNull(get(issuer, "/api/history").body)
        Regex("\"point\":\\{[^}]*}").findAll(history).toList().let { points ->
            assertTrue(points.isNotEmpty(), "모든 줄에 표기가 붙는다: $history")
            points.forEach {
                assertTrue(it.value.contains("\"name\":\"온포인트\""), it.value)
                assertTrue(it.value.contains("\"emoji\":\"🔵\""), it.value)
                assertTrue(it.value.contains("\"accent\":\"blue\""), it.value)
                assertTrue(it.value.contains("\"issuerHandle\":\"@onmart\""), it.value)
                assertTrue(it.value.contains("\"nameIsShared\":false"), it.value)
            }
        }
    }

    private fun issue(amount: Long) =
        post(issuer, "/api/issues", IssueRequest(point.publicId.toString(), BigDecimal(amount)))

    private fun idOf(body: String) = assertNotNull(Regex("\"id\":\"([^\"]+)\"").find(body)).groupValues[1]

    private fun get(who: User, path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.GET, HttpEntity<Void>(authOf(who)), String::class.java)

    private fun post(who: User, path: String, body: Any, key: String = UUID.randomUUID().toString()) =
        restTemplate.exchange(
            path,
            HttpMethod.POST,
            HttpEntity(body, authOf(who).apply { set("Idempotency-Key", key) }),
            String::class.java,
        )

    private fun patch(path: String, body: Any) = restTemplate.exchange(
        path,
        HttpMethod.PATCH,
        HttpEntity(body, authOf(issuer).apply { set("Idempotency-Key", UUID.randomUUID().toString()) }),
        String::class.java,
    )

    private fun authOf(who: User) = HttpHeaders().apply { setBearerAuth(token(who)) }

    private fun token(who: User): String = assertNotNull(
        restTemplate.postForEntity("/api/auth/login", LoginRequest(who.handle, "point"), LoginResponse::class.java).body,
    ).accessToken

    private fun publicId(who: User) = assertNotNull(userRepository.findById(who.id!!).orElse(null)).publicId.toString()

    private fun save(handle: String, name: String) =
        userRepository.save(User(name = name, handle = handle, passwordHash = passwordEncoder.encode("point")!!))
}

package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.pointtype.ChangeCapRequest
import io.github.miinhho.point.pointtype.CreatePointTypeRequest
import io.github.miinhho.point.pointtype.Membership
import io.github.miinhho.point.pointtype.MembershipRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.transfer.TransferRequest
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.wallet.Balance
import io.github.miinhho.point.wallet.BalanceRepository
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
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 계약: docs/API.md 「회원 자격」 — 닿을 수 없는 비공개 은행은 **없는 것과 같아야** 한다.
 *
 * 어느 한 경로라도 `403` 이나 `422` 로 갈리면 그 은행이 존재한다는 사실이 확정된다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class BankPageTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var membershipRepository: MembershipRepository
    @Autowired lateinit var balanceRepository: BalanceRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    lateinit var issuer: User
    lateinit var member: User
    lateinit var leftBehind: User
    lateinit var stranger: User
    lateinit var open: PointType
    lateinit var closed: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()

        issuer = save("@onmart", "온마트")
        member = save("@jisoo", "김지수")
        leftBehind = save("@nara", "이나라")
        stranger = save("@mose", "정모세")

        open = pointTypeRepository.save(point("온포인트", "ON", PointVisibility.PUBLIC))
        closed = pointTypeRepository.save(point("동아리비", "CL", PointVisibility.PRIVATE))

        // 은행장은 언제나 회원이다. 나간 사람은 회원이 아닌 채로 잔액만 남는다.
        membershipRepository.save(Membership(pointType = closed, user = issuer))
        membershipRepository.save(Membership(pointType = closed, user = member))
        balanceRepository.save(Balance(user = leftBehind, pointType = closed, amount = 3_000))
    }

    @Test
    fun `공개 은행 페이지는 누구나 보고 회원 수가 없다`() {
        val response = get(stranger, "/api/point-types/${open.publicId}")
        assertEquals(HttpStatus.OK, response.statusCode, response.body)
        val body = assertNotNull(response.body)
        assertTrue(body.contains("\"visibility\":\"public\""), body)
        assertTrue(body.contains("\"memberCount\":null"), "공개 은행에는 회원이 없다: $body")
    }

    @Test
    fun `비공개 은행은 회원과 잔액이 남은 사람이 본다`() {
        listOf(issuer, member, leftBehind).forEach {
            val response = get(it, "/api/point-types/${closed.publicId}")
            assertEquals(HttpStatus.OK, response.statusCode, "${it.handle} 는 볼 수 있어야 한다")
            assertTrue(assertNotNull(response.body).contains("\"memberCount\":2"), response.body)
        }
    }

    @Test
    fun `닿을 수 없는 사람에게 비공개 은행은 없는 것과 같다`() {
        val response = get(stranger, "/api/point-types/${closed.publicId}")
        assertEquals(HttpStatus.NOT_FOUND, response.statusCode, "403 은 존재를 알려 주는 셈이다")
        assertTrue(assertNotNull(response.body).contains("\"code\":\"POINT_TYPE_NOT_FOUND\""), response.body)
    }

    @Test
    fun `쓰기 경로도 없는 포인트와 같은 404 를 준다`() {
        val absent = UUID.randomUUID().toString()
        listOf(closed.publicId.toString(), absent).forEach { id ->
            val cap = patch(stranger, "/api/point-types/$id/cap", ChangeCapRequest(BigDecimal(2_000_000)))
            assertEquals(HttpStatus.NOT_FOUND, cap.statusCode, "상한 변경이 403 으로 갈리면 존재가 샌다: $id")

            val issue = post(stranger, "/api/issues", TransferRequest(pointTypeId = id, amount = BigDecimal(1_000)))
            assertEquals(HttpStatus.NOT_FOUND, issue.statusCode, "발행이 403 으로 갈리면 존재가 샌다: $id")

            val send = post(
                stranger,
                "/api/transfers",
                TransferRequest(pointTypeId = id, toId = publicId(member), amount = BigDecimal(1_000)),
            )
            assertEquals(HttpStatus.NOT_FOUND, send.statusCode, "이체가 422 로 갈리면 존재가 샌다: $id")
        }
    }

    @Test
    fun `거절당한 이체가 남긴 잔액 0 행은 문을 열어 주지 않는다`() {
        // 잔액 0 행이 있는 상태 — 이체가 차감에 실패해도 이 행은 남는다.
        balanceRepository.save(Balance(user = stranger, pointType = closed, amount = 0))

        assertEquals(HttpStatus.NOT_FOUND, get(stranger, "/api/point-types/${closed.publicId}").statusCode)
        val list = assertNotNull(get(stranger, "/api/point-types").body)
        assertFalse(list.contains("동아리비"), "가진 적 없는 사람에게 열리면 안 된다: $list")
    }

    @Test
    fun `목록에도 담기지 않는다`() {
        val mine = assertNotNull(get(member, "/api/point-types").body)
        assertTrue(mine.contains("동아리비"), "회원에게는 담긴다: $mine")

        val theirs = assertNotNull(get(stranger, "/api/point-types").body)
        assertFalse(theirs.contains("동아리비"), "닿을 수 없으면 목록에서도 보이지 않는다: $theirs")
        assertTrue(theirs.contains("온포인트"), "공개 은행은 남아 있어야 한다: $theirs")
    }

    @Test
    fun `없는 id 와 id 가 아닌 문자열은 같은 404 다`() {
        listOf(UUID.randomUUID().toString(), "not-a-uuid").forEach {
            assertEquals(HttpStatus.NOT_FOUND, get(stranger, "/api/point-types/$it").statusCode, it)
        }
    }

    @Test
    fun `창설은 visibility 를 명시적으로 받는다`() {
        val missing = create(issuer, CreatePointTypeRequest("동네빵집", "BK", "orange", BigDecimal(1_000_000)))
        assertEquals(HttpStatus.BAD_REQUEST, missing.statusCode, "기본값을 두면 모르는 사이에 열린다")
        assertTrue(assertNotNull(missing.body).contains("\"code\":\"MALFORMED_REQUEST\""), missing.body)

        val nonsense = create(issuer, CreatePointTypeRequest("동네빵집", "BK", "orange", BigDecimal(1_000_000), "secret"))
        assertEquals(HttpStatus.BAD_REQUEST, nonsense.statusCode, nonsense.body)
    }

    @Test
    fun `비공개로 창설하면 은행장이 곧 회원이다`() {
        val created = create(issuer, CreatePointTypeRequest("동네빵집", "BK", "orange", BigDecimal(1_000_000), "private"))
        assertEquals(HttpStatus.CREATED, created.statusCode, created.body)
        val body = assertNotNull(created.body)
        assertTrue(body.contains("\"visibility\":\"private\""), body)
        assertTrue(body.contains("\"memberCount\":1"), "은행장은 나갈 수 없으므로 언제나 회원이다: $body")

        // 공개는 그 반대다 — 회원 개념 자체가 없다.
        val public = create(issuer, CreatePointTypeRequest("솔카페", "SL", "teal", BigDecimal(1_000_000), "public"))
        assertTrue(assertNotNull(public.body).contains("\"memberCount\":null"), public.body)
    }

    @Test
    fun `상한과 유통량은 보유자에게도 온다`() {
        val body = assertNotNull(get(leftBehind, "/api/point-types/${closed.publicId}").body)
        assertTrue(body.contains("\"issueCap\":1000000"), "상한은 보유자에게 하는 약속이다: $body")
        assertTrue(body.contains("\"totalIssued\":0"), body)
        assertTrue(body.contains("\"canIssue\":false"), "바꾸는 힘만 발행자 것이다: $body")
    }

    @Test
    fun `나간 사람의 지갑에는 그 포인트가 남는다`() {
        val wallet = assertNotNull(get(leftBehind, "/api/wallet").body)
        assertTrue(wallet.contains("동아리비"), "쓸 수 없는 채로 남는 것이 설계다: $wallet")
    }

    private fun get(who: User, path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.GET, HttpEntity<Void>(authOf(who)), String::class.java)

    private fun post(who: User, path: String, body: Any): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.POST, HttpEntity(body, keyedAuthOf(who)), String::class.java)

    private fun patch(who: User, path: String, body: Any): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.PATCH, HttpEntity(body, keyedAuthOf(who)), String::class.java)

    private fun create(who: User, body: CreatePointTypeRequest): ResponseEntity<String> =
        restTemplate.postForEntity("/api/point-types", HttpEntity(body, keyedAuthOf(who)), String::class.java)

    private fun authOf(who: User) = HttpHeaders().apply { setBearerAuth(token(who)) }

    private fun keyedAuthOf(who: User) = authOf(who).apply { set("Idempotency-Key", UUID.randomUUID().toString()) }

    private fun token(who: User): String = assertNotNull(
        restTemplate.postForEntity("/api/auth/login", LoginRequest(who.handle, "point"), LoginResponse::class.java).body,
    ).accessToken

    private fun publicId(who: User) = assertNotNull(userRepository.findById(who.id!!).orElse(null)).publicId.toString()

    private fun save(handle: String, name: String) =
        userRepository.save(User(name = name, handle = handle, passwordHash = passwordEncoder.encode("point")!!))

    private fun point(name: String, symbol: String, visibility: PointVisibility) = PointType(
        name = name,
        symbol = symbol,
        issuer = issuer,
        accent = PointAccent.BLUE,
        visibility = visibility,
        issueCap = 1_000_000,
        totalIssued = 0,
    )
}

package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.pointtype.ChangeCapRequest
import io.github.miinhho.point.pointtype.ChangeDescriptionRequest
import io.github.miinhho.point.pointtype.CreatePointTypeRequest
import io.github.miinhho.point.membership.Membership
import io.github.miinhho.point.membership.MembershipRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.transfer.TransferRequest
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.ledger.Account
import io.github.miinhho.point.ledger.AccountKind
import io.github.miinhho.point.ledger.AccountRepository
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
    @Autowired lateinit var bankFixture: BankFixture
    @Autowired lateinit var ledgerFixture: LedgerFixture
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var membershipRepository: MembershipRepository
    @Autowired lateinit var accountRepository: AccountRepository
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

        open = bankFixture.open(point("온포인트", "🏪", PointVisibility.PUBLIC))
        closed = bankFixture.open(point("동아리비", "🎪", PointVisibility.PRIVATE))

        // 은행장은 언제나 회원이다. 나간 사람은 회원이 아닌 채로 잔액만 남는다.
        membershipRepository.save(Membership(pointType = closed, user = issuer))
        membershipRepository.save(Membership(pointType = closed, user = member))
        ledgerFixture.giveThenLeave(closed, leftBehind, 3_000)
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

    // 계약: docs/API.md 「한 번 받은 사람은 영원히 닿는다」. 행은 사건에서만 나므로
    // 행의 존재가 곧 「받은 적 있다」다 — 거절당한 이체는 아무 행도 남기지 않는다.
    @Test
    fun `거절당한 이체는 계정 행을 남기지 않는다`() {
        val before = accountRepository.count()
        val blocked = post(
            stranger,
            "/api/transfers",
            TransferRequest(pointTypeId = closed.publicId.toString(), toId = publicId(member), amount = BigDecimal(1_000)),
        )
        assertEquals(HttpStatus.NOT_FOUND, blocked.statusCode, blocked.body)

        assertEquals(before, accountRepository.count(), "거절이 행을 남기면 그 행이 문을 열어 준다")
        assertEquals(HttpStatus.NOT_FOUND, get(stranger, "/api/point-types/${closed.publicId}").statusCode)
        val list = assertNotNull(get(stranger, "/api/point-types").body)
        assertFalse(list.contains("동아리비"), "가진 적 없는 사람에게 열리면 안 된다: $list")
    }

    /**
     * 계약: docs/API.md 「한 번 받은 사람은 영원히 닿는다」. 이름의 뜻이 「잔액이 있다」에서
     * 「받은 적 있다」로 넓어진 것은 집합 비교로는 안 보인다 — 행동으로 못 박는다.
     */
    @Test
    fun `다 쓰고 나간 사람도 비공개 은행에 닿고 카드가 남는다`() {
        // 받은 적 있고, 잔액 0 이고, 회원이 아니다.
        ledgerFixture.join(closed, stranger)
        ledgerFixture.give(closed, stranger, 1_000)
        val spend = post(
            stranger,
            "/api/transfers",
            TransferRequest(pointTypeId = closed.publicId.toString(), toId = publicId(member), amount = BigDecimal(1_000)),
        )
        assertEquals(HttpStatus.CREATED, spend.statusCode, spend.body)
        assertEquals(HttpStatus.NO_CONTENT, delete(stranger, "/api/point-types/${closed.publicId}/members/me").statusCode)

        assertEquals(HttpStatus.OK, get(stranger, "/api/point-types/${closed.publicId}").statusCode, "이미 본 은행을 다시 감출 수는 없다")
        val wallet = assertNotNull(get(stranger, "/api/wallet").body)
        assertTrue(wallet.contains("동아리비"), "가졌던 것도 지갑에 남는다: $wallet")
        assertTrue(wallet.contains("\"amount\":0,\"neverSpent\":false,\"sendable\":0"), wallet)
    }

    @Test
    fun `다 쓴 사람도 은행에 닿고 카드가 남는다`() {
        ledgerFixture.give(open, stranger, 1_000)
        val spend = post(
            stranger,
            "/api/transfers",
            TransferRequest(pointTypeId = open.publicId.toString(), toId = publicId(member), amount = BigDecimal(1_000)),
        )
        assertEquals(HttpStatus.CREATED, spend.statusCode, spend.body)

        // 가진 것과 가졌던 것은 다르다 — 0 이 된 카드가 사라지면 둘이 같아진다.
        assertEquals(HttpStatus.OK, get(stranger, "/api/point-types/${open.publicId}").statusCode)
        assertTrue(assertNotNull(get(stranger, "/api/wallet").body).contains("\"amount\":0"), "다 쓴 카드가 남는다")
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
        val missing = create(issuer, CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000)))
        assertEquals(HttpStatus.BAD_REQUEST, missing.statusCode, "기본값을 두면 모르는 사이에 열린다")
        assertTrue(assertNotNull(missing.body).contains("\"code\":\"MALFORMED_REQUEST\""), missing.body)

        val nonsense = create(issuer, CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000), "secret"))
        assertEquals(HttpStatus.BAD_REQUEST, nonsense.statusCode, nonsense.body)
    }

    @Test
    fun `비공개로 창설하면 은행장이 곧 회원이다`() {
        val created = create(issuer, CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000), "private"))
        assertEquals(HttpStatus.CREATED, created.statusCode, created.body)
        val body = assertNotNull(created.body)
        assertTrue(body.contains("\"visibility\":\"private\""), body)
        assertTrue(body.contains("\"memberCount\":1"), "은행장은 나갈 수 없으므로 언제나 회원이다: $body")

        // 공개는 그 반대다 — 회원 개념 자체가 없다.
        val public = create(issuer, CreatePointTypeRequest("솔카페", "🍞", null, "teal", BigDecimal(1_000_000), "public"))
        assertTrue(assertNotNull(public.body).contains("\"memberCount\":null"), public.body)
    }

    @Test
    fun `이모지는 겹쳐도 되고 소개는 없어도 만들어진다`() {
        val a = create(issuer, CreatePointTypeRequest("동네빵집", "🍞", "골목 끝 빵집이에요", "orange", BigDecimal(1_000_000), "public"))
        assertEquals(HttpStatus.CREATED, a.statusCode, a.body)
        assertTrue(assertNotNull(a.body).contains("\"emoji\":\"🍞\""), a.body)
        assertTrue(assertNotNull(a.body).contains("\"description\":\"골목 끝 빵집이에요\""), a.body)

        // 같은 이모지를 다시 쓴다 — 유일성은 버렸다.
        val b = create(issuer, CreatePointTypeRequest("옆집빵집", "🍞", null, "orange", BigDecimal(1_000_000), "public"))
        assertEquals(HttpStatus.CREATED, b.statusCode, b.body)
        assertTrue(assertNotNull(b.body).contains("\"description\":null"), "없어도 만들어진다: ${b.body}")
    }

    @Test
    fun `소개는 발행자만 바꾸고 60자를 넘지 못한다`() {
        val created = assertNotNull(
            create(issuer, CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000), "public")).body,
        )
        val id = Regex("\"id\":\"([^\"]+)\"").find(created)!!.groupValues[1]

        val mine = patch(issuer, "/api/point-types/$id", ChangeDescriptionRequest("빵 사면 쌓여요"))
        assertEquals(HttpStatus.OK, mine.statusCode, mine.body)
        assertTrue(assertNotNull(mine.body).contains("\"description\":\"빵 사면 쌓여요\""), mine.body)

        val theirs = patch(member, "/api/point-types/$id", ChangeDescriptionRequest("내가 바꾼다"))
        assertEquals(HttpStatus.FORBIDDEN, theirs.statusCode, theirs.body)
        assertTrue(assertNotNull(theirs.body).contains("NOT_ISSUER"), theirs.body)

        val tooLong = patch(issuer, "/api/point-types/$id", ChangeDescriptionRequest("가".repeat(61)))
        assertEquals(HttpStatus.BAD_REQUEST, tooLong.statusCode, tooLong.body)

        // 빈 문자열은 지운다는 뜻이다.
        val cleared = patch(issuer, "/api/point-types/$id", ChangeDescriptionRequest(""))
        assertTrue(assertNotNull(cleared.body).contains("\"description\":null"), cleared.body)
    }

    @Test
    fun `상한과 유통량은 보유자에게도 온다`() {
        val body = assertNotNull(get(leftBehind, "/api/point-types/${closed.publicId}").body)
        assertTrue(body.contains("\"issueCap\":1000000"), "상한은 보유자에게 하는 약속이다: $body")
        // 픽스처가 나간 사람 몫으로 3000 을 찍었다 — 유통량의 정본은 발행 계정 잔액이다.
        assertTrue(body.contains("\"totalIssued\":3000"), body)
        assertTrue(body.contains("\"issuableHeadroom\":997000"), body)
        assertTrue(body.contains("\"canIssue\":false"), "바꾸는 힘만 발행자 것이다: $body")
    }

    @Test
    fun `나간 사람의 지갑에는 그 포인트가 남는다`() {
        val wallet = assertNotNull(get(leftBehind, "/api/wallet").body)
        assertTrue(wallet.contains("동아리비"), "쓸 수 없는 채로 남는 것이 설계다: $wallet")
    }

    private fun delete(who: User, path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.DELETE, HttpEntity<Void>(authOf(who)), String::class.java)

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

    private fun point(name: String, emoji: String, visibility: PointVisibility) = PointType(
        name = name,
        emoji = emoji,
        issuer = issuer,
        accent = PointAccent.BLUE,
        visibility = visibility,
        issueCap = 1_000_000,
    )
}

package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.pointtype.membership.Membership
import io.github.miinhho.point.pointtype.membership.MembershipRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.issue.IssueRequest
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
 * 계약: docs/API.md 「회원 자격」 — 비공개 은행에서 회원이 아닌 사람은 **없는 사람과
 * 구별되지 않아야** 한다. 그래서 새 실패 코드를 두지 않고 `RECIPIENT_NOT_FOUND` 다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class PrivateBankMembersTest {
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
    lateinit var outsider: User
    lateinit var open: PointType
    lateinit var closed: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()

        issuer = save("@onmart", "온마트")
        member = save("@jisoo", "김지수")
        leftBehind = save("@nara", "이나라")
        outsider = save("@mose", "김지수")

        open = bankFixture.open(point("온포인트", "🏪", PointVisibility.PUBLIC))
        closed = bankFixture.open(point("동아리비", "🎪", PointVisibility.PRIVATE))

        membershipRepository.save(Membership(pointType = closed, user = member))
        // 은행장은 발행으로, 회원은 받아서, 나간 사람은 받고 나가서 잔액을 갖는다.
        ledgerFixture.issue(closed, 100_000)
        ledgerFixture.give(closed, member, 100_000)
        ledgerFixture.giveThenLeave(closed, leftBehind, 100_000)
        ledgerFixture.issue(open, 100_000)
    }

    @Test
    fun `회원 목록은 세 가지로 답한다`() {
        val mine = assertNotNull(get(member, "/api/point-types/${closed.publicId}/members").body)
        assertTrue(mine.contains("@onmart") && mine.contains("@jisoo"), "회원 전원이 담긴다: $mine")
        assertFalse(mine.contains("@nara"), "나간 사람은 담기지 않는다: $mine")

        // 나간 사람은 은행 페이지를 이미 본다 — 감출 것이 남아 있지 않으므로 404 가 아니다.
        val left = get(leftBehind, "/api/point-types/${closed.publicId}/members")
        assertEquals(HttpStatus.FORBIDDEN, left.statusCode, left.body)
        assertTrue(assertNotNull(left.body).contains("\"code\":\"NOT_MEMBER\""), left.body)

        // 빈 배열도 NOT_MEMBER 도 아니다 — 「가입하면 된다」로 읽히면 없는 길을 알려 주는 것이다.
        val public = get(issuer, "/api/point-types/${open.publicId}/members")
        assertEquals(HttpStatus.NOT_FOUND, public.statusCode, public.body)
        assertTrue(assertNotNull(public.body).contains("\"code\":\"NOT_A_PRIVATE_BANK\""), public.body)

        // 닿을 수 없는 사람에게는 은행 페이지와 같은 404 다.
        val stranger = get(outsider, "/api/point-types/${closed.publicId}/members")
        assertEquals(HttpStatus.NOT_FOUND, stranger.statusCode)
        assertTrue(assertNotNull(stranger.body).contains("\"code\":\"POINT_TYPE_NOT_FOUND\""), stranger.body)
    }

    @Test
    fun `받는 사람 목록이 회원으로 좁아진다`() {
        val body = assertNotNull(get(issuer, "/api/users?pointTypeId=${closed.publicId}").body)
        assertTrue(body.contains("@jisoo"), "회원은 담긴다: $body")
        assertFalse(body.contains("@nara"), "나간 사람은 담기지 않는다: $body")
        assertFalse(body.contains("@mose"), "회원이었던 적 없는 사람도 담기지 않는다: $body")
    }

    @Test
    fun `공개 은행은 좁아지지 않는다`() {
        val body = assertNotNull(get(issuer, "/api/users?pointTypeId=${open.publicId}").body)
        listOf("@jisoo", "@nara", "@mose").forEach { assertTrue(body.contains(it), "$it 이 담겨야 한다: $body") }
    }

    @Test
    fun `회원이 아닌 사람에게는 명부가 나가지 않는다`() {
        // 나간 사람은 은행 페이지에는 닿지만 회원 명부는 못 본다.
        assertEquals("[]", get(leftBehind, "/api/users?pointTypeId=${closed.publicId}").body)
        assertEquals("[]", get(outsider, "/api/users?pointTypeId=${closed.publicId}").body)
    }

    // 계약: docs/API.md 「필터 인자」 — 전역을 뒤지는 조회의 문은 「회원인가」다. 최근 목록이
    // 지금 회원만 걸러 돌려주면, 이름이 나온다는 것 자체가 그 사람이 아직 회원이라는 답이 된다.
    @Test
    fun `최근 보낸 사람도 회원이 아니면 나가지 않는다`() {
        // 회원이던 동안 보낸 기록을 남기고 나간다.
        membershipRepository.save(Membership(pointType = closed, user = leftBehind))
        assertEquals(HttpStatus.CREATED, send(leftBehind, closed, member).statusCode)
        assertEquals(HttpStatus.NO_CONTENT, delete(leftBehind, "/api/point-types/${closed.publicId}/members/me").statusCode)

        assertEquals("[]", get(leftBehind, "/api/recent?pointTypeId=${closed.publicId}").body, "나간 사람에게 지금 회원의 이름이 나간다")

        // 회원에게는 그대로 나온다 — 문이 닫힌 것이지 기능이 꺼진 것이 아니다.
        assertEquals(HttpStatus.CREATED, send(issuer, closed, member).statusCode)
        assertTrue(assertNotNull(get(issuer, "/api/recent?pointTypeId=${closed.publicId}").body).contains("@jisoo"))
    }

    @Test
    fun `없는 포인트로 좁히면 빈 목록이다`() {
        assertEquals("[]", get(issuer, "/api/users?pointTypeId=${UUID.randomUUID()}").body)
        assertEquals("[]", get(issuer, "/api/users?pointTypeId=not-a-uuid").body)
    }

    @Test
    fun `회원이 아닌 사람에게 보내면 없는 사람과 같은 404 다`() {
        val toLeftBehind = send(issuer, closed, leftBehind)
        assertEquals(HttpStatus.NOT_FOUND, toLeftBehind.statusCode, toLeftBehind.body)
        assertTrue(assertNotNull(toLeftBehind.body).contains("\"code\":\"RECIPIENT_NOT_FOUND\""), toLeftBehind.body)

        // 없는 사람에게 보낸 것과 응답이 같아야 한다 — 구별되면 회원 여부가 새어 나간다.
        val toNobody = post(
            issuer,
            "/api/transfers",
            TransferRequest(closed.publicId.toString(), UUID.randomUUID().toString(), BigDecimal(1_000)),
        )
        assertEquals(toNobody.statusCode, toLeftBehind.statusCode)
        assertEquals(toNobody.body, toLeftBehind.body)
    }

    @Test
    fun `회원끼리는 그대로 오간다`() {
        val ok = send(issuer, closed, member)
        assertEquals(HttpStatus.CREATED, ok.statusCode, ok.body)

        val public = send(issuer, open, outsider)
        assertEquals(HttpStatus.CREATED, public.statusCode, "공개 은행에는 회원 개념이 없다: ${public.body}")
    }

    @Test
    fun `나온 사람의 잔액은 남지만 보낼 수 없다고 실려 온다`() {
        val wallet = assertNotNull(get(leftBehind, "/api/wallet").body)
        assertTrue(wallet.contains("\"amount\":100000,\"neverSpent\":true,\"sendable\":0"), "쓸 수 없는 채로 남는다: $wallet")

        val mine = assertNotNull(get(member, "/api/wallet").body)
        assertTrue(mine.contains("\"amount\":100000,\"neverSpent\":true,\"sendable\":100000"), "회원의 잔액은 그대로다: $mine")
    }

    @Test
    fun `서버가 못 한다고 답한 것을 서버가 해 주지 않는다`() {
        // sendable 이 0 인데 같은 이체가 성사되면 그 사이로 돈이 실제로 움직인다.
        val wallet = assertNotNull(get(leftBehind, "/api/wallet").body)
        assertTrue(wallet.contains("\"sendable\":0"), wallet)

        val blocked = send(leftBehind, closed, member)
        assertEquals(HttpStatus.FORBIDDEN, blocked.statusCode, blocked.body)
        assertTrue(assertNotNull(blocked.body).contains("\"code\":\"NOT_MEMBER\""), blocked.body)

        // 받는 쪽 코드를 재사용하지 않는다 — 그러면 받는 사람 핸들을 다시 확인하게 된다.
        assertFalse(assertNotNull(blocked.body).contains("RECIPIENT_NOT_FOUND"), blocked.body)
    }

    @Test
    fun `neverSpent 는 그 포인트로 보내면 꺼진다`() {
        assertTrue(assertNotNull(get(issuer, "/api/wallet").body).contains("\"neverSpent\":true"))

        assertEquals(HttpStatus.CREATED, send(issuer, closed, member).statusCode)

        val after = assertNotNull(get(issuer, "/api/wallet").body)
        val closedCard = assertNotNull(Regex("\\{\"pointType\":\\{[^}]*\"emoji\":\"🎪\".*?\"sendable\":\\d+}").find(after)).value
        assertTrue(closedCard.contains("\"neverSpent\":false"), "보냈으면 꺼진다: $closedCard")

        // 받기만 한 사람은 켜져 있다 — 아직 판단하지 않은 것이 맞다.
        assertTrue(assertNotNull(get(member, "/api/wallet").body).contains("\"neverSpent\":true"))
    }

    @Test
    fun `이체에는 상대가 실려 오고 발행은 아예 다른 타입이다`() {
        val sent = send(issuer, closed, member)
        assertEquals(HttpStatus.CREATED, sent.statusCode, sent.body)
        // 보낸 쪽이 보는 상대는 받은 사람이다.
        assertTrue(
            assertNotNull(sent.body).contains("\"counterparty\":{\"name\":\"김지수\",\"handle\":\"@jisoo\",\"nameIsShared\":true}"),
            "겹침도 원장 전체에서 센다: ${sent.body}",
        )

        // 받은 쪽이 보는 상대는 보낸 사람이다 — 같은 이체인데 방향이 다르다.
        val theirHistory = assertNotNull(get(member, "/api/history").body)
        assertTrue(theirHistory.contains("\"handle\":\"@onmart\""), "받은 쪽에는 보낸 사람이 실린다: $theirHistory")

        // 발행에는 상대라는 칸 자체가 없다 — 빈 칸을 두면 뜻 없는 말로 채워진다.
        val issued = post(
            issuer,
            "/api/issues",
            IssueRequest(pointTypeId = closed.publicId.toString(), amount = BigDecimal(1_000)),
        )
        assertEquals(HttpStatus.CREATED, issued.statusCode, issued.body)
        val body = assertNotNull(issued.body)
        listOf("counterparty", "toId", "fromId", "kind").forEach {
            assertFalse(body.contains("\"$it\""), "$it 은 이체의 칸이다: $body")
        }
        assertTrue(body.contains("\"totalIssuedAfter\":") && body.contains("\"issueCapAt\":"), body)
    }

    private fun send(from: User, pointType: PointType, to: User) = post(
        from,
        "/api/transfers",
        TransferRequest(pointType.publicId.toString(), publicId(to), BigDecimal(1_000)),
    )

    private fun delete(who: User, path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.DELETE, HttpEntity<Void>(authOf(who)), String::class.java)

    private fun get(who: User, path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.GET, HttpEntity<Void>(authOf(who)), String::class.java)

    private fun patch(who: User, path: String, body: Any): ResponseEntity<String> {
        val headers = authOf(who).apply { set("Idempotency-Key", UUID.randomUUID().toString()) }
        return restTemplate.exchange(path, HttpMethod.PATCH, HttpEntity(body, headers), String::class.java)
    }

    private fun post(who: User, path: String, body: Any): ResponseEntity<String> {
        val headers = authOf(who).apply { set("Idempotency-Key", UUID.randomUUID().toString()) }
        return restTemplate.exchange(path, HttpMethod.POST, HttpEntity(body, headers), String::class.java)
    }

    private fun authOf(who: User) = HttpHeaders().apply { setBearerAuth(token(who)) }

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
    )
}

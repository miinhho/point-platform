package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.pointtype.InviteRequest
import io.github.miinhho.point.pointtype.Membership
import io.github.miinhho.point.pointtype.MembershipRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
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
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** 계약: docs/API.md 「회원 자격」 — 초대 · 수락 · 나가기 · 내보내기. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class InviteTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var membershipRepository: MembershipRepository
    @Autowired lateinit var balanceRepository: BalanceRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    lateinit var issuer: User
    lateinit var member: User
    lateinit var outsider: User
    lateinit var closed: PointType
    lateinit var open: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()
        issuer = save("@onmart", "온마트")
        member = save("@jisoo", "김지수")
        outsider = save("@mose", "정모세")
        closed = pointTypeRepository.save(point("동아리비", "🎪", PointVisibility.PRIVATE))
        open = pointTypeRepository.save(point("온포인트", "🔵", PointVisibility.PUBLIC))
        membershipRepository.save(Membership(pointType = closed, user = issuer))
        membershipRepository.save(Membership(pointType = closed, user = member))
    }

    @Test
    fun `초대하면 받는 사람이 판단할 것이 다 실려 온다`() {
        val invited = invite(issuer, closed, outsider)
        assertEquals(HttpStatus.CREATED, invited.statusCode, invited.body)
        val body = assertNotNull(invited.body)
        assertTrue(body.contains("\"byHandle\":\"@onmart\""), body)
        assertTrue(body.contains("\"issuerHandle\":\"@onmart\"") && body.contains("\"createdAt\""), "은행이 통째로 온다: $body")

        // 초대받은 사람은 아직 회원이 아니어도 판단하러 페이지에 온다.
        assertEquals(HttpStatus.OK, get(outsider, "/api/point-types/${closed.publicId}").statusCode)
        assertTrue(assertNotNull(get(outsider, "/api/invites").body).contains("동아리비"))
    }

    @Test
    fun `이미 초대된 사람을 다시 초대하면 같은 초대다`() {
        val first = assertNotNull(invite(issuer, closed, outsider).body)
        val again = invite(issuer, closed, outsider)
        assertEquals(HttpStatus.CREATED, again.statusCode)
        assertEquals(idOf(first), idOf(assertNotNull(again.body)), "새로 만들지 않는다")
    }

    @Test
    fun `이미 회원인 사람을 초대하면 409 다`() {
        val response = invite(issuer, closed, member)
        assertEquals(HttpStatus.CONFLICT, response.statusCode, response.body)
        assertTrue(assertNotNull(response.body).contains("ALREADY_MEMBER"), response.body)
    }

    @Test
    fun `초대는 은행장만 하고 공개 은행에는 없다`() {
        assertEquals(HttpStatus.FORBIDDEN, invite(member, closed, outsider).statusCode)
        val public = invite(issuer, open, outsider)
        assertEquals(HttpStatus.NOT_FOUND, public.statusCode, public.body)
        assertTrue(assertNotNull(public.body).contains("NOT_A_PRIVATE_BANK"), public.body)
    }

    @Test
    fun `수락하면 회원이 되고 초대가 사라진다`() {
        val inviteId = idOf(assertNotNull(invite(issuer, closed, outsider).body))

        val accepted = post(outsider, "/api/invites/$inviteId/accept")
        assertEquals(HttpStatus.OK, accepted.statusCode, accepted.body)
        assertTrue(assertNotNull(accepted.body).contains("\"memberCount\":3"), accepted.body)
        assertEquals("[]", get(outsider, "/api/invites").body, "수락하면 초대가 사라진다")

        // 응답을 못 받고 다시 눌러도 실패를 주지 않는다 — 그가 원한 결과가 이미 있다.
        val again = post(outsider, "/api/invites/$inviteId/accept")
        assertEquals(HttpStatus.OK, again.statusCode, again.body)
    }

    @Test
    fun `남의 초대와 없는 초대는 같은 404 다`() {
        val inviteId = idOf(assertNotNull(invite(issuer, closed, outsider).body))
        val theirs = post(member, "/api/invites/$inviteId/accept")
        val absent = post(member, "/api/invites/${UUID.randomUUID()}/accept")
        assertEquals(HttpStatus.NOT_FOUND, theirs.statusCode, theirs.body)
        assertEquals(absent.statusCode, theirs.statusCode)
        assertEquals(absent.body, theirs.body, "다르면 누가 초대됐는지가 샌다")
        assertTrue(assertNotNull(theirs.body).contains("INVITE_NOT_FOUND"), theirs.body)
    }

    @Test
    fun `나가도 잔액은 남고 은행장은 나갈 수 없다`() {
        balanceRepository.save(Balance(user = member, pointType = closed, amount = 5_000))

        assertEquals(HttpStatus.NO_CONTENT, delete(member, "/api/point-types/${closed.publicId}/members/me").statusCode)
        val wallet = assertNotNull(get(member, "/api/wallet").body)
        assertTrue(wallet.contains("\"amount\":5000,\"neverSpent\":true,\"sendable\":0"), "쓸 수 없는 채로 남는다: $wallet")
        assertFalse(assertNotNull(get(issuer, "/api/point-types/${closed.publicId}/members").body).contains("@jisoo"))

        val leaving = delete(issuer, "/api/point-types/${closed.publicId}/members/me")
        assertEquals(HttpStatus.CONFLICT, leaving.statusCode, leaving.body)
        assertTrue(assertNotNull(leaving.body).contains("ISSUER_CANNOT_LEAVE"), leaving.body)
    }

    @Test
    fun `내보내기는 은행장만 하고 은행장은 내보내지지 않는다`() {
        assertEquals(HttpStatus.FORBIDDEN, delete(member, "/api/point-types/${closed.publicId}/members/${publicId(issuer)}").statusCode)

        val issuerOut = delete(issuer, "/api/point-types/${closed.publicId}/members/${publicId(issuer)}")
        assertEquals(HttpStatus.CONFLICT, issuerOut.statusCode, issuerOut.body)

        assertEquals(
            HttpStatus.NO_CONTENT,
            delete(issuer, "/api/point-types/${closed.publicId}/members/${publicId(member)}").statusCode,
        )
        assertTrue(assertNotNull(get(issuer, "/api/point-types/${closed.publicId}/members").body).contains("@onmart"))
    }

    private fun invite(who: User, bank: PointType, target: User) =
        post(who, "/api/point-types/${bank.publicId}/invites", InviteRequest(publicId(target)))

    private fun idOf(body: String) = assertNotNull(Regex("\"id\":\"([^\"]+)\"").find(body)).groupValues[1]

    private fun get(who: User, path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.GET, HttpEntity<Void>(authOf(who)), String::class.java)

    private fun delete(who: User, path: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.DELETE, HttpEntity<Void>(authOf(who)), String::class.java)

    private fun post(who: User, path: String, body: Any? = null): ResponseEntity<String> {
        val headers = authOf(who).apply { set("Idempotency-Key", UUID.randomUUID().toString()) }
        return restTemplate.exchange(path, HttpMethod.POST, HttpEntity(body ?: "", headers), String::class.java)
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
        issueCap = 1_000_000,
        totalIssued = 0,
    )
}

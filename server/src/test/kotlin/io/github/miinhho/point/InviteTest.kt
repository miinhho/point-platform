package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.pointtype.ChangeCapRequest
import io.github.miinhho.point.pointtype.membership.InviteRepository
import io.github.miinhho.point.pointtype.membership.InviteRequest
import io.github.miinhho.point.pointtype.membership.Membership
import io.github.miinhho.point.pointtype.membership.MembershipRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
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
    @Autowired lateinit var bankFixture: BankFixture
    @Autowired lateinit var ledgerFixture: LedgerFixture
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var membershipRepository: MembershipRepository
    @Autowired lateinit var inviteRepository: InviteRepository
    @Autowired lateinit var accountRepository: AccountRepository
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
        closed = bankFixture.open(point("동아리비", "🎪", PointVisibility.PRIVATE))
        open = bankFixture.open(point("온포인트", "🏪", PointVisibility.PUBLIC))
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

        val accepted = accept(outsider)
        assertEquals(HttpStatus.OK, accepted.statusCode, accepted.body)
        assertTrue(assertNotNull(accepted.body).contains("\"memberCount\":3"), accepted.body)
        assertEquals("[]", get(outsider, "/api/invites").body, "수락하면 초대가 사라진다")

        // 응답을 못 받고 다시 눌러도 실패를 주지 않는다 — 그가 원한 결과가 이미 있다.
        val again = accept(outsider)
        assertEquals(HttpStatus.OK, again.statusCode, again.body)
    }

    @Test
    fun `수락하면 잔액이 0 이어도 지갑에 담긴다`() {
        invite(issuer, closed, outsider)
        assertEquals(HttpStatus.OK, accept(outsider).statusCode)

        // 안 담으면 가입은 됐는데 그 은행이 어느 화면에도 없다 — 초대함은 수락으로 비었고
        // 내역에는 아직 아무 일도 없다.
        val wallet = assertNotNull(get(outsider, "/api/wallet").body)
        assertTrue(wallet.contains("동아리비"), wallet)
        assertTrue(wallet.contains("\"amount\":0"), wallet)
        assertTrue(wallet.contains("\"membership\":\"member\""), "세 가지 0 을 가를 재료가 실려 온다: $wallet")

        // 상한은 보유자에게 하는 약속이다. 카드를 주기로 했으면 그 약속이 바뀐 기록도 와야 한다.
        val capKey = UUID.randomUUID().toString()
        val cap = restTemplate.exchange(
            "/api/point-types/${closed.publicId}/cap",
            HttpMethod.PATCH,
            HttpEntity(ChangeCapRequest(java.math.BigDecimal(2_000_000)), authOf(issuer).apply { set("Idempotency-Key", capKey) }),
            String::class.java,
        )
        assertEquals(HttpStatus.OK, cap.statusCode, cap.body)
        val history = assertNotNull(get(outsider, "/api/history?limit=10").body)
        assertTrue(history.contains("capChange"), "지갑에 담기는 사람은 상한 변경도 본다: $history")

        // 내보내지면 관계가 끊긴다. 잔액도 없으므로 담을 이유가 없다.
        delete(issuer, "/api/point-types/${closed.publicId}/members/${publicId(outsider)}")
        assertFalse(assertNotNull(get(outsider, "/api/wallet").body).contains("동아리비"))
    }

    @Test
    fun `회원은 살아 있는 초대를 갖지 않는다`() {
        val first = idOf(assertNotNull(invite(issuer, closed, outsider).body))
        assertEquals(HttpStatus.OK, accept(outsider).statusCode)
        assertNoLiveInvite(outsider, "수락이 소진시킨다")

        val again = invite(issuer, closed, outsider)
        assertEquals(HttpStatus.CONFLICT, again.statusCode, again.body)
        assertNoLiveInvite(outsider, "회원 재초대는 409 라 초대를 만들지 않는다")

        assertEquals(
            HttpStatus.NO_CONTENT,
            delete(issuer, "/api/point-types/${closed.publicId}/members/${publicId(outsider)}").statusCode,
        )
        // 여기서 assertNoLiveInvite 는 아무것도 안 본다 — 회원이 아니라 교집합이 무조건 빈다.
        // 걸어 들어오는 길을 막는 것은 「내보낸 뒤 살아 있는 초대가 없다」 쪽이다.
        assertTrue(
            inviteRepository.pointTypeIdsInvitedTo(outsider.id!!).isEmpty(),
            "내보내기 뒤에 살아 있는 초대가 남으면 스스로 걸어 들어온다",
        )

        val second = idOf(assertNotNull(invite(issuer, closed, outsider).body))
        assertEquals(HttpStatus.OK, accept(outsider).statusCode)
        assertNoLiveInvite(outsider, "다시 회원이 돼도 그대로다")
    }

    // 깨지면 내보내진 사람의 초대함에 그 은행이 남아 스스로 걸어 들어온다.
    private fun assertNoLiveInvite(who: User, hint: String) {
        val both = membershipRepository.pointTypeIdsOf(who.id!!) intersect
            inviteRepository.pointTypeIdsInvitedTo(who.id!!)
        assertTrue(both.isEmpty(), "$hint — 회원인데 살아 있는 초대가 있다: $both")
    }

    @Test
    fun `내가 무엇인지는 서버가 싣는다`() {
        // 아무 관계도 없으면 페이지 자체가 404 라, outsider 가 보이는 자리는
        // 잔액이 남은 채 나온 사람이다. 잔액이 닿을 자격을 준다.
        assertEquals(HttpStatus.NOT_FOUND, get(outsider, "/api/point-types/${closed.publicId}").statusCode)
        ledgerFixture.giveThenLeave(closed, outsider, 3_000)
        assertTrue(bankOf(outsider, closed).contains("\"membership\":\"outsider\""), bankOf(outsider, closed))

        val inviteId = idOf(assertNotNull(invite(issuer, closed, outsider).body))
        assertTrue(bankOf(outsider, closed).contains("\"membership\":\"invited\""), bankOf(outsider, closed))

        accept(outsider)
        assertTrue(bankOf(outsider, closed).contains("\"membership\":\"member\""), bankOf(outsider, closed))

        delete(issuer, "/api/point-types/${closed.publicId}/members/${publicId(outsider)}")
        assertTrue(bankOf(outsider, closed).contains("\"membership\":\"outsider\""), "소진된 초대는 invited 가 아니다")

        assertTrue(bankOf(issuer, closed).contains("\"membership\":\"member\""), "은행장은 언제나 회원이다")
        // 공개 은행에는 회원 개념이 없다. outsider 로 두면 화면이 그릴 자리를 찾는다.
        assertTrue(bankOf(outsider, open).contains("\"membership\":null"), bankOf(outsider, open))
    }

    @Test
    fun `내보내면 초대함이 비고 스스로 걸어 들어올 수 없다`() {
        // 잔액이 은행에 닿을 자격을 준다 — 그래야 「보이는데 못 들어온다」가 시험된다.
        ledgerFixture.giveThenLeave(closed, outsider, 3_000)
        invite(issuer, closed, outsider)
        assertEquals(HttpStatus.OK, accept(outsider).statusCode)

        assertEquals(
            HttpStatus.NO_CONTENT,
            delete(issuer, "/api/point-types/${closed.publicId}/members/${publicId(outsider)}").statusCode,
        )

        assertEquals("[]", get(outsider, "/api/invites").body, "내보내진 사람의 초대함은 비어 있다")

        // 은행장에게는 초대를 취소할 길이 없다. 초대가 남아 있으면 내보내기가 무효가 된다.
        val walkBack = accept(outsider)
        assertEquals(HttpStatus.NOT_FOUND, walkBack.statusCode, walkBack.body)
        assertTrue(assertNotNull(walkBack.body).contains("INVITE_NOT_FOUND"), walkBack.body)
        assertFalse(assertNotNull(get(issuer, "/api/point-types/${closed.publicId}/members").body).contains("@mose"))
    }

    @Test
    fun `내보낸 사람을 다시 초대하면 새 초대가 선다`() {
        val first = idOf(assertNotNull(invite(issuer, closed, outsider).body))
        accept(outsider)
        delete(issuer, "/api/point-types/${closed.publicId}/members/${publicId(outsider)}")

        val again = invite(issuer, closed, outsider)
        assertEquals(HttpStatus.CREATED, again.statusCode, again.body)
        assertTrue(idOf(assertNotNull(again.body)) != first, "소진된 초대를 되살리지 않고 새로 만든다")

        // 되살리는 것은 은행장의 새 의사다.
        assertEquals(HttpStatus.OK, accept(outsider).statusCode)
    }

    @Test
    fun `같은 키로 다른 사람을 초대하면 그때 만든 초대를 준다`() {
        val key = UUID.randomUUID().toString()
        val first = inviteWithKey(key, outsider)
        assertEquals(HttpStatus.CREATED, first.statusCode, first.body)

        // 회원이면 ALREADY_MEMBER 로 먼저 걸려 키 충돌에 닿지 못한다.
        val second = inviteWithKey(key, save("@taeyun", "박태윤"))
        assertEquals(HttpStatus.OK, second.statusCode, second.body)
        assertEquals(idOf(assertNotNull(first.body)), idOf(assertNotNull(second.body)), "키가 답하는 것은 그때의 결과다")
    }

    @Test
    fun `초대받지 않은 사람에게는 은행이 있다는 것도 알려 주지 않는다`() {
        invite(issuer, closed, outsider)
        val stranger = save("@taeyun", "박태윤")

        val theirs = accept(stranger)
        val absent = post(stranger, "/api/point-types/${UUID.randomUUID()}/invites/accept")
        assertEquals(HttpStatus.NOT_FOUND, theirs.statusCode, theirs.body)
        assertEquals(absent.body, theirs.body, "다르면 그 은행이 있다는 것이 샌다")
        assertTrue(assertNotNull(theirs.body).contains("POINT_TYPE_NOT_FOUND"), theirs.body)
    }

    @Test
    fun `이미 나간 사람이 다시 나가도 204 다`() {
        // 잔액이 은행에 닿을 자격을 주므로 비회원도 이 길을 부를 수 있다.
        ledgerFixture.giveThenLeave(closed, outsider, 3_000)

        // 그가 원한 것은 회원이 아니게 되는 것이고 그는 이미 회원이 아니다.
        val leaving = delete(outsider, "/api/point-types/${closed.publicId}/members/me")
        assertEquals(HttpStatus.NO_CONTENT, leaving.statusCode, leaving.body)
    }

    @Test
    fun `잔액 없이 나간 사람이 다시 나가도 204 다`() {
        val first = delete(member, "/api/point-types/${closed.publicId}/members/me")
        assertEquals(HttpStatus.NO_CONTENT, first.statusCode, first.body)

        // 잔액이 없으면 나간 순간 은행에 닿지 못한다. 그래도 그가 원한 것은 이미 참이라
        // 「없어요」로 답하면 방금까지 보던 은행이 사라진 것으로 들린다.
        val again = delete(member, "/api/point-types/${closed.publicId}/members/me")
        assertEquals(HttpStatus.NO_CONTENT, again.statusCode, again.body)

        val absent = delete(member, "/api/point-types/${UUID.randomUUID()}/members/me")
        assertEquals(HttpStatus.NO_CONTENT, absent.statusCode, "없는 은행도 같은 답이다: ${absent.body}")

        // 공개 은행은 감출 것이 없어 답이 다르다 — 나갈 회원 자격이라는 개념이 없다.
        val public = delete(member, "/api/point-types/${open.publicId}/members/me")
        assertEquals(HttpStatus.NOT_FOUND, public.statusCode, public.body)
        assertTrue(assertNotNull(public.body).contains("NOT_A_PRIVATE_BANK"), public.body)
    }

    @Test
    fun `나가도 잔액은 남고 은행장은 나갈 수 없다`() {
        ledgerFixture.give(closed, member, 5_000)

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

    private fun inviteWithKey(key: String, target: User): ResponseEntity<String> {
        val headers = authOf(issuer).apply { set("Idempotency-Key", key) }
        return restTemplate.exchange(
            "/api/point-types/${closed.publicId}/invites",
            HttpMethod.POST,
            HttpEntity(InviteRequest(publicId(target)), headers),
            String::class.java,
        )
    }

    // 수락은 은행을 가리킨다 — 초대 id 는 소진되면 새것이 난다.
    private fun accept(who: User, bank: PointType = closed) =
        post(who, "/api/point-types/${bank.publicId}/invites/accept")

    private fun bankOf(who: User, bank: PointType) =
        assertNotNull(get(who, "/api/point-types/${bank.publicId}").body)

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
    )
}

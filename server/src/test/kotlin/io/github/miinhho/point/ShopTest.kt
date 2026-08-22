package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.pointtype.membership.Membership
import io.github.miinhho.point.pointtype.membership.MembershipRepository
import io.github.miinhho.point.shop.ListingRepository
import io.github.miinhho.point.shop.VoucherRepository
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
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 계약: docs/API.md 「상점」 · 여정 12·13.
 *
 * **되돌릴 수 없는 것이 여기 모인다** — 환불이 없고 교환권은 산 사람이 받은 유일한 것이다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class ShopTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var bankFixture: BankFixture
    @Autowired lateinit var ledgerFixture: LedgerFixture
    @Autowired lateinit var shopFixture: ShopFixture
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var accountRepository: AccountRepository
    @Autowired lateinit var listingRepository: ListingRepository
    @Autowired lateinit var voucherRepository: VoucherRepository
    @Autowired lateinit var membershipRepository: MembershipRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private lateinit var issuer: User
    private lateinit var buyer: User
    private lateinit var bank: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()
        issuer = userRepository.save(user("@minho", "장민호"))
        buyer = userRepository.save(user("@jisoo", "김지수"))
        bank = bankFixture.open(
            PointType(name = "금머니", emoji = "🎁", issuer = issuer, accent = PointAccent.PURPLE, visibility = PointVisibility.PUBLIC),
        )
    }

    @Test
    fun `게시한 품목이 목록과 단건 조회에 온다`() {
        val listing = shopFixture.list(bank, price = 3_000, stock = 5, perPersonLimit = 2)

        val list = get("/api/point-types/${bank.publicId}/listings", token("@jisoo"))
        assertEquals(HttpStatus.OK, list.statusCode)
        assertTrue(list.body!!.contains("\"remaining\":5"), list.body)
        assertTrue(list.body!!.contains("\"myRemainingLimit\":2"), list.body)

        val one = get("/api/listings/${listing.id}", token("@jisoo"))
        // 잔액이 0 이라 못 산다. 「왜 못 사는가」를 화면이 조합하지 않는다.
        assertTrue(one.body!!.contains("\"buyability\":\"insufficientBalance\""), one.body)
    }

    @Test
    fun `무제한 재고와 한도 없음은 null 로 온다`() {
        shopFixture.list(bank, stock = null, perPersonLimit = null)
        val body = get("/api/point-types/${bank.publicId}/listings", token("@jisoo")).body!!
        assertTrue(body.contains("\"stock\":null"), body)
        assertTrue(body.contains("\"remaining\":null"), body)
        assertTrue(body.contains("\"myRemainingLimit\":null"), body)
    }

    // 계약: 재고 없이 게시할 수 없다 — 무제한은 기본값이 아니라 고르는 것이다.
    @Test
    fun `재고 키가 빠지면 400 이다`() {
        val without = post(
            "/api/point-types/${bank.publicId}/listings",
            token("@minho"),
            """{"name":"아메리카노","price":3000,"perPersonLimit":null}""",
        )
        assertEquals(HttpStatus.BAD_REQUEST, without.statusCode, without.body)

        val withNull = post(
            "/api/point-types/${bank.publicId}/listings",
            token("@minho"),
            """{"name":"아메리카노","price":3000,"stock":null,"perPersonLimit":null}""",
        )
        assertEquals(HttpStatus.CREATED, withNull.statusCode, withNull.body)
    }

    @Test
    fun `같은 키로 다시 게시하면 같은 품목이 온다`() {
        val key = UUID.randomUUID().toString()
        val body = """{"name":"아메리카노","price":3000,"stock":5,"perPersonLimit":null}"""
        val first = post("/api/point-types/${bank.publicId}/listings", token("@minho"), body, key)
        assertEquals(HttpStatus.CREATED, first.statusCode, first.body)

        val again = post("/api/point-types/${bank.publicId}/listings", token("@minho"), body, key)
        assertEquals(HttpStatus.OK, again.statusCode, again.body)
        assertEquals(idOf(first), idOf(again))
        assertEquals(1, listingRepository.count())
    }

    @Test
    fun `은행장이 아니면 게시할 수 없다`() {
        val response = post(
            "/api/point-types/${bank.publicId}/listings",
            token("@jisoo"),
            """{"name":"아메리카노","price":3000,"stock":null,"perPersonLimit":null}""",
        )
        assertEquals(HttpStatus.FORBIDDEN, response.statusCode, response.body)
        assertTrue(response.body!!.contains("NOT_ISSUER"), response.body)
    }

    @Test
    fun `사면 포인트가 은행장에게 가고 교환권이 수량만큼 난다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 5)

        val response = buy(listing.id, token("@jisoo"), quantity = 2)
        assertEquals(HttpStatus.CREATED, response.statusCode, response.body)
        assertTrue(response.body!!.contains("\"quantity\":2"), response.body)
        assertTrue(response.body!!.contains("\"amount\":6000"), response.body)
        assertTrue(response.body!!.contains("\"outgoing\":true"), response.body)

        assertEquals(4_000, balanceOf(buyer), "산 사람에게서 6,000 이 빠진다")
        assertEquals(6_000, balanceOf(issuer), "은행장에게 그만큼 간다 — 유통량은 줄지 않는다")
        assertEquals(2, voucherRepository.count(), "교환권은 한 장이 한 개다")
    }

    @Test
    fun `같은 키로 다시 사도 새 교환권을 찍지 않는다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 5)
        val key = UUID.randomUUID().toString()

        val first = buy(listing.id, token("@jisoo"), quantity = 1, key = key)
        val again = buy(listing.id, token("@jisoo"), quantity = 1, key = key)

        assertEquals(HttpStatus.CREATED, first.statusCode, first.body)
        assertEquals(HttpStatus.OK, again.statusCode, again.body)
        assertEquals(idOf(first), idOf(again))
        assertEquals(1, voucherRepository.count())
        assertEquals(7_000, balanceOf(buyer), "잔액은 한 번만 빠진다")
    }

    @Test
    fun `은행장은 자기 품목을 살 수 없다`() {
        ledgerFixture.issue(bank, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)

        val response = buy(listing.id, token("@minho"), quantity = 1)
        assertEquals(HttpStatus.CONFLICT, response.statusCode, response.body)
        assertTrue(response.body!!.contains("ISSUER_CANNOT_BUY"), response.body)
    }

    // 계약: 셋을 사려는데 둘만 남았으면 둘을 팔지 않는다 — 세 개가 하나의 결정이다.
    @Test
    fun `재고보다 많이 사면 아무것도 팔지 않고 남은 수를 알려 준다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 2)

        val response = buy(listing.id, token("@jisoo"), quantity = 3)
        assertEquals(UNPROCESSABLE, response.statusCode, response.body)
        assertTrue(response.body!!.contains("OUT_OF_STOCK"), response.body)
        assertTrue(response.body!!.contains("\"remaining\":2"), response.body)
        assertEquals(0, voucherRepository.count(), "부분 판매가 없다")
    }

    @Test
    fun `1인 한도를 넘으면 남은 한도를 알려 준다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val listing = shopFixture.list(bank, price = 3_000, perPersonLimit = 3)
        buy(listing.id, token("@jisoo"), quantity = 2)

        val response = buy(listing.id, token("@jisoo"), quantity = 2)
        assertEquals(UNPROCESSABLE, response.statusCode, response.body)
        assertTrue(response.body!!.contains("PURCHASE_LIMIT_EXCEEDED"), response.body)
        assertTrue(response.body!!.contains("\"myRemainingLimit\":1"), response.body)
    }

    @Test
    fun `잔액이 모자라면 못 산다`() {
        ledgerFixture.give(bank, buyer, 1_000)
        val listing = shopFixture.list(bank, price = 3_000)

        val response = buy(listing.id, token("@jisoo"), quantity = 1)
        assertEquals(UNPROCESSABLE, response.statusCode, response.body)
        assertTrue(response.body!!.contains("INSUFFICIENT_BALANCE"), response.body)
        assertEquals(1_000, balanceOf(buyer))
    }

    @Test
    fun `비공개 은행의 비회원은 품목을 볼 수 없다`() {
        val private = bankFixture.open(
            PointType(name = "동아리비", emoji = "🎪", issuer = issuer, accent = PointAccent.BLUE, visibility = PointVisibility.PRIVATE),
        )
        membershipRepository.save(Membership(pointType = private, user = issuer))
        // 잔액이 남은 채 나간 사람은 닿기는 한다 — 닿지 못하면 404 이고 닿되 회원이 아니면 403 이다.
        ledgerFixture.giveThenLeave(private, buyer, 5_000)
        shopFixture.list(private)

        val response = get("/api/point-types/${private.publicId}/listings", token("@jisoo"))
        assertEquals(HttpStatus.FORBIDDEN, response.statusCode, response.body)
        assertTrue(response.body!!.contains("NOT_MEMBER"), response.body)
    }

    @Test
    fun `내린 품목은 사는 쪽에서 없는 것과 같다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)
        buy(listing.id, token("@jisoo"), quantity = 1)

        assertEquals(HttpStatus.NO_CONTENT, delete("/api/listings/${listing.id}", token("@minho")).statusCode)
        assertEquals(1, listingRepository.count(), "판 것이 있으면 행은 남는다 — 교환권이 가리킨다")
        assertEquals(1, voucherRepository.count(), "이미 산 사람의 교환권은 그대로다")

        val buying = buy(listing.id, token("@jisoo"), quantity = 1)
        assertEquals(HttpStatus.NOT_FOUND, buying.statusCode, buying.body)
        assertTrue(buying.body!!.contains("LISTING_NOT_FOUND"), buying.body)

        val seen = get("/api/listings/${listing.id}", token("@jisoo"))
        assertEquals(HttpStatus.NOT_FOUND, seen.statusCode, seen.body)

        // 은행장에게는 온다 — 무엇을 내렸는지는 그가 알아야 한다.
        val asIssuer = get("/api/listings/${listing.id}", token("@minho"))
        assertEquals(HttpStatus.OK, asIssuer.statusCode, asIssuer.body)
        assertTrue(asIssuer.body!!.contains("\"buyability\":\"unlisted\""), asIssuer.body)
    }

    @Test
    fun `아무도 안 산 품목을 내리면 행이 사라지고 다시 내려도 204 다`() {
        val listing = shopFixture.list(bank)

        assertEquals(HttpStatus.NO_CONTENT, delete("/api/listings/${listing.id}", token("@minho")).statusCode)
        assertEquals(0, listingRepository.count())
        // 이미 없는 것을 다시 내려도 204 다 — 사용자가 원한 결과가 이미 있다.
        assertEquals(HttpStatus.NOT_FOUND, delete("/api/listings/${listing.id}", token("@minho")).statusCode)
    }

    @Test
    fun `내린 품목은 고칠 수 없다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)
        buy(listing.id, token("@jisoo"), quantity = 1)
        delete("/api/listings/${listing.id}", token("@minho"))

        val response = patch("/api/listings/${listing.id}", token("@minho"), """{"stock":10}""")
        assertEquals(HttpStatus.CONFLICT, response.statusCode, response.body)
        assertTrue(response.body!!.contains("LISTING_UNLISTED"), response.body)
    }

    @Test
    fun `재고를 이미 판 수보다 낮출 수 없다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 5)
        buy(listing.id, token("@jisoo"), quantity = 2)

        val down = patch("/api/listings/${listing.id}", token("@minho"), """{"stock":1}""")
        assertEquals(UNPROCESSABLE, down.statusCode, down.body)
        assertTrue(down.body!!.contains("STOCK_BELOW_SOLD"), down.body)

        // 판 수까지는 내릴 수 있고 늘리는 것은 약속을 키우니 자유롭다.
        assertEquals(HttpStatus.OK, patch("/api/listings/${listing.id}", token("@minho"), """{"stock":2}""").statusCode)
        assertEquals(HttpStatus.OK, patch("/api/listings/${listing.id}", token("@minho"), """{"stock":9}""").statusCode)
    }

    // 계약: 빠진 키는 「그대로 둔다」이고 null 은 「제한을 없앤다」다.
    @Test
    fun `수정에서 빠진 키는 그대로 두고 null 은 제한을 없앤다`() {
        val listing = shopFixture.list(bank, stock = 5, perPersonLimit = 2)

        val only = patch("/api/listings/${listing.id}", token("@minho"), """{"description":"진하게"}""")
        assertEquals(HttpStatus.OK, only.statusCode, only.body)
        assertTrue(only.body!!.contains("\"stock\":5"), only.body)
        assertTrue(only.body!!.contains("\"perPersonLimit\":2"), only.body)

        val cleared = patch("/api/listings/${listing.id}", token("@minho"), """{"perPersonLimit":null}""")
        assertTrue(cleared.body!!.contains("\"perPersonLimit\":null"), cleared.body)
        assertTrue(cleared.body!!.contains("\"stock\":5"), cleared.body)
    }

    @Test
    fun `교환권은 가진 사람과 은행장이 보고 남에게는 없는 것과 같다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)
        val voucherId = voucherIdOf(buy(listing.id, token("@jisoo"), quantity = 1))

        assertEquals(HttpStatus.OK, get("/api/vouchers/$voucherId", token("@jisoo")).statusCode)
        assertEquals(HttpStatus.OK, get("/api/vouchers/$voucherId", token("@minho")).statusCode)

        userRepository.save(user("@taeyun", "박태윤"))
        val stranger = get("/api/vouchers/$voucherId", token("@taeyun"))
        assertEquals(HttpStatus.NOT_FOUND, stranger.statusCode, stranger.body)
    }

    @Test
    fun `redeem 은 은행장만 하고 두 번째가 그때를 덮지 않는다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)
        val voucherId = voucherIdOf(buy(listing.id, token("@jisoo"), quantity = 1))

        val byOwner = post("/api/vouchers/$voucherId/redeem", token("@jisoo"), "")
        assertEquals(HttpStatus.NOT_FOUND, byOwner.statusCode, "산 사람은 보기만 한다")

        val first = post("/api/vouchers/$voucherId/redeem", token("@minho"), "")
        assertEquals(HttpStatus.OK, first.statusCode, first.body)
        val firstAt = redeemedAtOf(first)
        assertNotNull(firstAt)

        val second = post("/api/vouchers/$voucherId/redeem", token("@minho"), "")
        assertEquals(HttpStatus.OK, second.statusCode, second.body)
        assertEquals(firstAt, redeemedAtOf(second), "일어난 일은 일어난 때의 값을 갖는다")
    }

    @Test
    fun `내 교환권은 은행으로 좁혀지고 없는 은행 id 는 빈 목록이다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)
        buy(listing.id, token("@jisoo"), quantity = 2)

        val mine = get("/api/vouchers", token("@jisoo"))
        assertEquals(2, Regex("\"purchaseId\"").findAll(mine.body!!).count())

        val filtered = get("/api/vouchers?pointTypeId=${bank.publicId}", token("@jisoo"))
        assertEquals(2, Regex("\"purchaseId\"").findAll(filtered.body!!).count())

        val nowhere = get("/api/vouchers?pointTypeId=${UUID.randomUUID()}", token("@jisoo"))
        assertEquals("[]", nowhere.body?.trim())

        // 은행장의 교환권은 없다 — 그는 파는 쪽이다.
        assertEquals("[]", get("/api/vouchers", token("@minho")).body?.trim())
    }

    @Test
    fun `구매는 산 사람과 은행장의 내역에 각각 한 줄로 온다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)
        buy(listing.id, token("@jisoo"), quantity = 1)

        val mine = get("/api/history", token("@jisoo")).body!!
        assertTrue(mine.contains("\"type\":\"purchase\""), mine)
        assertTrue(mine.contains("\"outgoing\":true"), mine)

        val theirs = get("/api/history", token("@minho")).body!!
        assertTrue(theirs.contains("\"type\":\"purchase\""), theirs)
        assertTrue(theirs.contains("\"outgoing\":false"), theirs)
    }

    @Test
    fun `by-key 는 남의 것이면 리터럴 null 이다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000)
        val key = UUID.randomUUID().toString()
        buy(listing.id, token("@jisoo"), quantity = 1, key = key)

        val mine = get("/api/purchases/by-key?idempotencyKey=$key", token("@jisoo"))
        assertNotNull(idOf(mine))

        val theirs = get("/api/purchases/by-key?idempotencyKey=$key", token("@minho"))
        assertEquals(HttpStatus.OK, theirs.statusCode)
        assertEquals("null", theirs.body?.trim(), "남의 것은 없을 때와 같다")

        val nothing = get("/api/purchases/by-key?idempotencyKey=${UUID.randomUUID()}", token("@jisoo"))
        assertEquals("null", nothing.body?.trim())
    }

    @Test
    fun `다 팔린 품목도 목록에 남고 0 이라고 말한다`() {
        ledgerFixture.give(bank, buyer, 10_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 1)
        buy(listing.id, token("@jisoo"), quantity = 1)

        val body = get("/api/point-types/${bank.publicId}/listings", token("@jisoo")).body!!
        assertTrue(body.contains("\"remaining\":0"), body)
        assertTrue(body.contains("\"buyability\":\"soldOut\""), body)
    }

    private fun user(handle: String, name: String) =
        User(name = name, handle = handle, passwordHash = passwordEncoder.encode("point")!!)

    private fun balanceOf(user: User) =
        accountRepository.findByUserId(user.id!!).firstOrNull { it.pointTypeId == bank.id }?.balance ?: 0

    private fun token(handle: String): String =
        assertNotNull(restTemplate.postForEntity("/api/auth/login", LoginRequest(handle, "point"), LoginResponse::class.java).body).accessToken

    private fun get(path: String, token: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.GET, HttpEntity<Void>(bearer(token)), String::class.java)

    private fun delete(path: String, token: String): ResponseEntity<String> =
        restTemplate.exchange(path, HttpMethod.DELETE, HttpEntity<Void>(bearer(token)), String::class.java)

    private fun post(path: String, token: String, body: String, key: String = UUID.randomUUID().toString()) =
        restTemplate.exchange(path, HttpMethod.POST, HttpEntity(body, bearer(token, key)), String::class.java)

    private fun patch(path: String, token: String, body: String) =
        restTemplate.exchange(path, HttpMethod.PATCH, HttpEntity(body, bearer(token)), String::class.java)

    private fun buy(listingId: String, token: String, quantity: Int, key: String = UUID.randomUUID().toString()) =
        post("/api/listings/$listingId/purchases", token, """{"quantity":$quantity}""", key)

    private fun bearer(token: String, key: String? = null) = HttpHeaders().apply {
        setBearerAuth(token)
        contentType = MediaType.APPLICATION_JSON
        key?.let { set("Idempotency-Key", it) }
    }

    private fun idOf(response: ResponseEntity<String>) =
        Regex("\"id\":\"([^\"]+)\"").find(assertNotNull(response.body))?.groupValues?.get(1)

    // 교환권 목록은 구매 다음에 온다 — 첫 id 는 구매의 것이라 그 뒤를 본다.
    private fun voucherIdOf(response: ResponseEntity<String>): String {
        val vouchers = assertNotNull(response.body).substringAfter("\"vouchers\":")
        return assertNotNull(Regex("\"id\":\"([^\"]+)\"").find(vouchers)).groupValues[1]
    }

    private fun redeemedAtOf(response: ResponseEntity<String>): String? =
        Regex("\"redeemedAt\":(\"[^\"]+\"|null)").find(assertNotNull(response.body))?.groupValues?.get(1)
            ?.takeIf { it != "null" }
}

// 스프링 7 에서 422 의 이름이 UNPROCESSABLE_CONTENT 로 바뀌었다 — 숫자로 잡는다.
private val UNPROCESSABLE: HttpStatusCode = HttpStatusCode.valueOf(422)

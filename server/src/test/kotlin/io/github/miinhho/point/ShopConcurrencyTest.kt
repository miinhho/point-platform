package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointVisibility
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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 계약: docs/API.md 「상점」 — **품목 행이 그 품목의 뮤텍스다.**
 *
 * 순차로는 전부 통과하는 것들이다. 환불이 없으므로 여기가 마지막 방어선이고, 여기서 새면
 * 재고가 음수가 되거나 교환권이 두 벌 찍힌다 — 둘 다 되돌릴 곳이 없다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class ShopConcurrencyTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var bankFixture: BankFixture
    @Autowired lateinit var ledgerFixture: LedgerFixture
    @Autowired lateinit var shopFixture: ShopFixture
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var accountRepository: AccountRepository
    @Autowired lateinit var listingRepository: ListingRepository
    @Autowired lateinit var voucherRepository: VoucherRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private lateinit var issuer: User
    private lateinit var buyer: User
    private lateinit var other: User
    private lateinit var bank: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()
        issuer = userRepository.save(user("@minho", "장민호"))
        buyer = userRepository.save(user("@jisoo", "김지수"))
        other = userRepository.save(user("@taeyun", "박태윤"))
        bank = bankFixture.open(
            PointType(name = "금머니", emoji = "🎁", issuer = issuer, accent = PointAccent.PURPLE, visibility = PointVisibility.PUBLIC),
        )
    }

    @Test
    fun `마지막 하나를 둘이 동시에 사면 하나만 팔린다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        ledgerFixture.give(bank, other, 100_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 1)
        val tokens = listOf(token("@jisoo"), token("@taeyun"))

        val responses = inParallel(2) { first -> buy(listing.id, tokens[if (first) 0 else 1], 1) }

        assertEquals(1, responses.count { it.statusCode == HttpStatus.CREATED }, responses.map { it.statusCode }.toString())
        val refused = responses.single { it.statusCode != HttpStatus.CREATED }
        assertEquals(UNPROCESSABLE, refused.statusCode, refused.body)
        assertTrue(refused.body!!.contains("OUT_OF_STOCK"), refused.body)
        assertEquals(1, voucherRepository.count(), "재고가 음수가 되지 않는다")
    }

    @Test
    fun `같은 키로 동시에 여덟 번 사도 교환권은 한 장이다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val listing = shopFixture.list(bank, price = 3_000)
        val token = token("@jisoo")
        val key = UUID.randomUUID().toString()

        val responses = inParallel(8) { buy(listing.id, token, 1, key) }

        assertTrue(responses.all { it.statusCode.is2xxSuccessful }, responses.map { it.statusCode }.toString())
        assertEquals(1, voucherRepository.count(), "다시 누른 것뿐이다 — 새로 찍지 않는다")
        assertEquals(1, responses.map { idOf(it) }.distinct().size, "여덟이 전부 같은 구매를 본다")
        assertEquals(97_000, balanceOf(buyer), "잔액은 한 번만 빠진다")
    }

    /**
     * **멱등성이 재고보다 먼저다.** 두 축이 교차하는 자리 — 같은 키가 겹치면서 이긴 쪽이
     * 마지막 하나를 쓰면, 진 쪽은 멱등성 unique 에 닿기도 전에 재고에 걸린다. 그러면 돈이
     * 나갔는데 응답이 「재고가 부족해요 · 아무것도 나가지 않았어요」다.
     *
     * 발행이 같은 사고를 먼저 겪었다 — `Ledger.issue` 의 「사건이 첫 쓰기다」 주석이 그것이다.
     */
    @Test
    fun `마지막 하나를 같은 키로 동시에 두 번 사도 전부 같은 답이다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 1)
        val token = token("@jisoo")
        val key = UUID.randomUUID().toString()

        val responses = inParallel(2) { buy(listing.id, token, 1, key) }

        assertTrue(
            responses.all { it.statusCode.is2xxSuccessful },
            "진 쪽도 그때의 결과를 본다 — 다시 누른 것뿐이다: ${responses.map { it.statusCode to it.body }}",
        )
        assertEquals(1, responses.map { idOf(it) }.distinct().size, "둘이 같은 구매를 본다")
        assertEquals(1, voucherRepository.count())
        assertEquals(97_000, balanceOf(buyer))
    }

    @Test
    fun `한도 하나를 같은 키로 동시에 두 번 사도 전부 같은 답이다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val listing = shopFixture.list(bank, price = 3_000, perPersonLimit = 1)
        val token = token("@jisoo")
        val key = UUID.randomUUID().toString()

        val responses = inParallel(2) { buy(listing.id, token, 1, key) }

        assertTrue(
            responses.all { it.statusCode.is2xxSuccessful },
            "1인 한도도 같다 — 같은 키는 같은 요청이다: ${responses.map { it.statusCode to it.body }}",
        )
        assertEquals(1, voucherRepository.count())
    }

    // 계약: 한도 3 에 이미 2 를 산 사람이 2 를 동시에 → 둘 다 거절이고 부분 판매가 없다.
    @Test
    fun `한도 경계에서 동시에 사면 부분 판매가 없다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val listing = shopFixture.list(bank, price = 3_000, perPersonLimit = 3)
        val token = token("@jisoo")
        assertEquals(HttpStatus.CREATED, buy(listing.id, token, 2).statusCode)

        val responses = inParallel(2) { buy(listing.id, token, 2) }

        assertTrue(
            responses.all { it.statusCode == UNPROCESSABLE },
            responses.map { it.statusCode to it.body }.toString(),
        )
        assertTrue(responses.all { it.body!!.contains("PURCHASE_LIMIT_EXCEEDED") })
        assertEquals(2, voucherRepository.count(), "한도를 넘겨 팔지 않는다")
    }

    /**
     * 재고를 낮추는 것과 구매가 겹치는 자리. 확인하는 사이 구매가 끼면 확인은 통과하고
     * **판 수가 재고를 넘는다** — 상한 변경이 발행과 같은 행을 잠그는 것과 같은 모양이다.
     */
    @Test
    fun `재고 낮추기와 구매가 겹쳐도 판 수가 재고를 넘지 않는다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val listing = shopFixture.list(bank, price = 3_000, stock = 3)
        assertEquals(HttpStatus.CREATED, buy(listing.id, token("@jisoo"), 1).statusCode)
        val buyerToken = token("@jisoo")
        val issuerToken = token("@minho")

        val responses = inParallel(2) { first ->
            if (first) patch("/api/listings/${listing.id}", issuerToken, """{"stock":2}""")
            else buy(listing.id, buyerToken, 2)
        }

        assertTrue(responses.all { it.statusCode.is2xxSuccessful || it.statusCode == UNPROCESSABLE })
        val sold = voucherRepository.count()
        val stock = listingRepository.findAll().single().stock!!
        assertTrue(sold <= stock, "판 수 $sold 가 재고 $stock 를 넘었다")
    }

    @Test
    fun `다른 품목의 구매는 서로 막지 않는다`() {
        ledgerFixture.give(bank, buyer, 100_000)
        val coffee = shopFixture.list(bank, name = "아메리카노", price = 3_000, stock = 1)
        val bread = shopFixture.list(bank, name = "소금빵", price = 4_000, stock = 1)
        val token = token("@jisoo")

        val responses = inParallel(2) { first -> buy(if (first) coffee.id else bread.id, token, 1) }

        assertEquals(2, responses.count { it.statusCode == HttpStatus.CREATED }, responses.map { it.statusCode }.toString())
        assertEquals(2, voucherRepository.count())
        assertEquals(93_000, balanceOf(buyer))
    }

    private fun user(handle: String, name: String) =
        User(name = name, handle = handle, passwordHash = passwordEncoder.encode("point")!!)

    private fun balanceOf(user: User) =
        accountRepository.findByUserId(user.id!!).firstOrNull { it.pointTypeId == bank.id }?.balance ?: 0

    private fun token(handle: String): String =
        assertNotNull(restTemplate.postForEntity("/api/auth/login", LoginRequest(handle, "point"), LoginResponse::class.java).body).accessToken

    private fun buy(listingId: String, token: String, quantity: Int, key: String = UUID.randomUUID().toString()) =
        restTemplate.exchange(
            "/api/listings/$listingId/purchases",
            HttpMethod.POST,
            HttpEntity("""{"quantity":$quantity}""", bearer(token, key)),
            String::class.java,
        )

    private fun patch(path: String, token: String, body: String) =
        restTemplate.exchange(path, HttpMethod.PATCH, HttpEntity(body, bearer(token)), String::class.java)

    private fun bearer(token: String, key: String? = null) = HttpHeaders().apply {
        setBearerAuth(token)
        contentType = MediaType.APPLICATION_JSON
        key?.let { set("Idempotency-Key", it) }
    }

    private fun idOf(response: ResponseEntity<String>) =
        assertNotNull(Regex("\"id\":\"([^\"]+)\"").find(assertNotNull(response.body))).groupValues[1]

    /** 모든 요청이 같은 순간에 출발하게 맞춘다 — 어긋나면 동시성이 시험되지 않는다. */
    private fun inParallel(count: Int, call: (first: Boolean) -> ResponseEntity<String>): List<ResponseEntity<String>> {
        val pool = Executors.newFixedThreadPool(count)
        val ready = CountDownLatch(count)
        val go = CountDownLatch(1)
        val futures = List(count) { index ->
            pool.submit<ResponseEntity<String>> {
                ready.countDown()
                go.await()
                call(index == 0)
            }
        }
        assertTrue(ready.await(10, TimeUnit.SECONDS))
        go.countDown()
        return futures.map { it.get(30, TimeUnit.SECONDS) }.also { pool.shutdown() }
    }
}

// 스프링 7 에서 422 의 이름이 UNPROCESSABLE_CONTENT 로 바뀌었다 — 숫자로 잡는다.
private val UNPROCESSABLE: HttpStatusCode = HttpStatusCode.valueOf(422)

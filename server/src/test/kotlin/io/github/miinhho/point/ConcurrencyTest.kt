package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.auth.RefreshRequest
import io.github.miinhho.point.domain.auth.RefreshTokenRepository
import io.github.miinhho.point.domain.balance.Balance
import io.github.miinhho.point.domain.balance.BalanceRepository
import io.github.miinhho.point.domain.pointtype.PointAccent
import io.github.miinhho.point.domain.pointtype.PointType
import io.github.miinhho.point.domain.pointtype.PointTypeRepository
import io.github.miinhho.point.domain.transfer.TransferRepository
import io.github.miinhho.point.domain.user.User
import io.github.miinhho.point.domain.user.UserRepository
import io.github.miinhho.point.transfer.TransferRequest
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
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import java.math.BigDecimal
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 계약: docs/API.md 「동시에 왔을 때」.
 * 순차 테스트로는 전부 통과하는 것들이라, 반드시 동시에 쏴서 확인한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class ConcurrencyTest {
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var balanceRepository: BalanceRepository
    @Autowired lateinit var transferRepository: TransferRepository
    @Autowired lateinit var refreshTokenRepository: RefreshTokenRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private lateinit var issuer: User
    private lateinit var recipient: User
    private lateinit var pointType: PointType

    @BeforeEach
    fun seed() {
        transferRepository.deleteAll()
        balanceRepository.deleteAll()
        pointTypeRepository.deleteAll()
        refreshTokenRepository.deleteAll()
        userRepository.deleteAll()

        issuer = userRepository.save(user("@minho", "장민호"))
        recipient = userRepository.save(user("@jisoo", "김지수"))
        pointType = pointTypeRepository.save(
            PointType(
                name = "금머니",
                symbol = "GM",
                issuer = issuer,
                accent = PointAccent.PURPLE,
                issueCap = 1_000_000,
                totalIssued = 0,
            ),
        )
    }

    @Test
    fun `같은 멱등성 키로 동시에 보내도 이체는 하나만 생긴다`() {
        giveBalance(issuer, 1_000_000)
        val token = login("@minho").accessToken
        val key = UUID.randomUUID().toString()

        val responses = inParallel(8) {
            postTransfer(token, key, TransferRequest(pointTypeId = publicPointTypeId(), toId = publicId(recipient), amount = BigDecimal(30_000)))
        }

        assertTrue(responses.all { it.statusCode.is2xxSuccessful }, "전부 성공 응답이어야 한다: ${responses.map { it.statusCode }}")
        assertEquals(1, transferRepository.count(), "이체는 정확히 하나만 생겨야 한다")
        val ids = responses.mapNotNull { transferIdOf(it.body) }.toSet()
        assertEquals(1, ids.size, "모두 같은 이체를 돌려받아야 한다")
        assertEquals(1_000_000 - 30_000, balanceOf(issuer), "잔액은 한 번만 빠져야 한다")
    }

    @Test
    fun `같은 지갑에서 동시에 보내도 잔액이 음수가 되지 않는다`() {
        giveBalance(issuer, 10_000)
        val token = login("@minho").accessToken

        val responses = inParallel(8) {
            postTransfer(token, UUID.randomUUID().toString(), TransferRequest(pointTypeId = publicPointTypeId(), toId = publicId(recipient), amount = BigDecimal(6_000)))
        }

        assertEquals(1, responses.count { it.statusCode == HttpStatus.CREATED }, "잔액이 6000 두 번을 감당하지 못하므로 하나만 성공해야 한다")
        assertEquals(4_000, balanceOf(issuer))
        assertTrue(balanceOf(issuer) >= 0, "잔액은 음수가 될 수 없다")
        // 진 쪽은 422 여야 한다. 500 이면 클라이언트는 "결과를 모른다"고 보고 재시도 경로를 탄다.
        val losers = responses.filter { it.statusCode != HttpStatus.CREATED }
        assertTrue(
            losers.all { it.statusCode.value() == 422 },
            "진 요청은 전부 422 INSUFFICIENT_BALANCE 여야 한다: ${losers.map { it.statusCode }}",
        )
    }

    @Test
    fun `잔액 행이 없는 상대에게 동시에 처음 보내도 깨지지 않는다`() {
        giveBalance(issuer, 1_000_000)
        val token = login("@minho").accessToken

        // 받는 사람에게 이 포인트의 잔액 행이 아직 없다 — 여럿이 동시에 그 행을 만들려 한다.
        val responses = inParallel(8) {
            postTransfer(token, UUID.randomUUID().toString(), TransferRequest(pointTypeId = publicPointTypeId(), toId = publicId(recipient), amount = BigDecimal(1_000)))
        }

        assertTrue(
            responses.all { it.statusCode == HttpStatus.CREATED },
            "전부 성공해야 한다 — 잔액 행 생성 경쟁이 요청을 깨면 안 된다: ${responses.map { it.statusCode }}",
        )
        assertEquals(8_000, balanceOf(recipient))
        assertEquals(1_000_000 - 8_000, balanceOf(issuer))
    }

    @Test
    fun `동시에 발행해도 상한을 넘지 않는다`() {
        pointType.totalIssued = 995_000
        pointTypeRepository.save(pointType)
        val token = login("@minho").accessToken

        val responses = inParallel(6) {
            postIssue(token, UUID.randomUUID().toString(), TransferRequest(pointTypeId = publicPointTypeId(), amount = BigDecimal(3_000)))
        }

        assertEquals(1, responses.count { it.statusCode == HttpStatus.CREATED }, "여유가 5000 뿐이라 3000 발행은 한 번만 성공해야 한다")
        val after = pointTypeRepository.findById(pointType.id!!).orElseThrow()
        assertTrue(after.totalIssued <= after.issueCap, "총 유통량이 상한을 넘었다: ${after.totalIssued} > ${after.issueCap}")
        assertEquals(998_000, after.totalIssued)
    }

    @Test
    fun `refresh 회전이 겹치면 하나만 성공하고 진 쪽이 사슬을 죽이지 않는다`() {
        val session = login("@minho")

        val responses = inParallel(2) {
            restTemplate.postForEntity("/api/auth/refresh", RefreshRequest(session.refreshToken), String::class.java)
        }
        assertEquals(1, responses.count { it.statusCode == HttpStatus.OK }, "회전은 하나만 성공해야 한다")

        // 진 쪽이 재사용 탐지를 발동시켰다면 이긴 쪽의 새 토큰까지 죽어 있다.
        val winner = responses.first { it.statusCode == HttpStatus.OK }.body!!
        val nextRefresh = Regex("\"refreshToken\":\"([^\"]+)\"").find(winner)!!.groupValues[1]
        val afterRace = restTemplate.postForEntity("/api/auth/refresh", RefreshRequest(nextRefresh), String::class.java)
        assertEquals(HttpStatus.OK, afterRace.statusCode, "동시 회전에서 진 쪽이 정상 사용자의 세션을 죽이면 안 된다")
    }

    @Test
    fun `핸들은 정규화된 형태로 저장돼 표기가 달라도 한 사람이다`() {
        userRepository.save(user("@Taeyun", "박태윤"))
        assertNotNull(userRepository.findByHandle("@taeyun"), "저장 시점에 정규화됐어야 한다")

        for (variant in listOf("taeyun", "TAEYUN", "@@Taeyun")) {
            assertEquals(HttpStatus.OK, restTemplate.postForEntity("/api/auth/login", LoginRequest(variant, "point"), String::class.java).statusCode, variant)
        }
    }

    private fun user(handle: String, name: String) =
        User(name = name, handle = handle, passwordHash = passwordEncoder.encode("point")!!)

    private fun giveBalance(user: User, amount: Long) {
        balanceRepository.save(Balance(user = user, pointType = pointType, amount = amount))
    }

    private fun balanceOf(user: User) =
        balanceRepository.findByUserId(user.id!!).firstOrNull { it.pointType.id == pointType.id }?.amount ?: 0

    private fun publicId(user: User) = user.publicId.toString()
    private fun publicPointTypeId() = pointType.publicId.toString()

    private fun login(handle: String): LoginResponse =
        assertNotNull(restTemplate.postForEntity("/api/auth/login", LoginRequest(handle, "point"), LoginResponse::class.java).body)

    private fun postTransfer(token: String, key: String, body: TransferRequest) =
        exchange("/api/transfers", token, key, body)

    private fun postIssue(token: String, key: String, body: TransferRequest) =
        exchange("/api/issues", token, key, body)

    // 성공은 TransferResponse, 실패는 { code } 라 본문 모양이 다르다 — String 으로 받고 필요할 때만 판다.
    private fun exchange(path: String, token: String, key: String, body: TransferRequest): ResponseEntity<String> {
        val headers = HttpHeaders().apply {
            setBearerAuth(token)
            set("Idempotency-Key", key)
        }
        return restTemplate.exchange(path, HttpMethod.POST, HttpEntity(body, headers), String::class.java)
    }

    private fun transferIdOf(body: String?) = body?.let { Regex("\"id\":\"([^\"]+)\"").find(it)?.groupValues?.get(1) }

    /** 모든 요청이 같은 순간에 출발하게 맞춘다 — 어긋나면 동시성이 시험되지 않는다. */
    private fun <T : Any> inParallel(count: Int, call: () -> ResponseEntity<T>): List<ResponseEntity<T>> {
        val pool = Executors.newFixedThreadPool(count)
        val ready = CountDownLatch(count)
        val go = CountDownLatch(1)
        val futures = List(count) {
            pool.submit<ResponseEntity<T>> {
                ready.countDown()
                go.await()
                call()
            }
        }
        assertTrue(ready.await(10, TimeUnit.SECONDS))
        go.countDown()
        val results = futures.map { it.get(30, TimeUnit.SECONDS) }
        pool.shutdown()
        return results
    }
}

private val HttpStatusCode.is2xxSuccessful: Boolean get() = this.is2xxSuccessful()

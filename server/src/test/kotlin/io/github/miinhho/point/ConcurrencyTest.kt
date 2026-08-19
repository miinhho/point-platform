package io.github.miinhho.point

import io.github.miinhho.point.pointtype.ChangeCapRequest
import io.github.miinhho.point.pointtype.CreatePointTypeRequest
import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.auth.RefreshRequest
import io.github.miinhho.point.auth.RefreshTokenRepository
import io.github.miinhho.point.wallet.Balance
import io.github.miinhho.point.wallet.BalanceRepository
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.transfer.TransferRepository
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.transfer.TransferRequest
import io.github.miinhho.point.pointtype.CapChangeRepository
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
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var balanceRepository: BalanceRepository
    @Autowired lateinit var transferRepository: TransferRepository
    @Autowired lateinit var refreshTokenRepository: RefreshTokenRepository
    @Autowired lateinit var capChangeRepository: CapChangeRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private lateinit var issuer: User
    private lateinit var recipient: User
    private lateinit var pointType: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()

        issuer = userRepository.save(user("@minho", "장민호"))
        recipient = userRepository.save(user("@jisoo", "김지수"))
        pointType = pointTypeRepository.save(
            PointType(
                name = "금머니",
                emoji = "💰",
                issuer = issuer,
                accent = PointAccent.PURPLE,
                visibility = PointVisibility.PUBLIC,
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

    // 계약: docs/API.md — 키는 「내가 같은 요청을 두 번 보냈나」에 답한다.
    // 전역 unique 면 남이 내 키를 선점하고, 선점당한 쪽은 무한 재시도에 빠진다.
    @Test
    fun `다른 사용자가 같은 키로 보내면 둘 다 각각 성공한다`() {
        giveBalance(issuer, 100_000)
        val third = userRepository.save(user("@taeyun", "박태윤"))
        balanceRepository.save(Balance(user = third, pointType = pointType, amount = 100_000))
        val key = UUID.randomUUID().toString()

        val mine = postTransfer(
            login("@minho").accessToken,
            key,
            TransferRequest(pointTypeId = publicPointTypeId(), toId = publicId(recipient), amount = BigDecimal(1_000)),
        )
        val theirs = postTransfer(
            login("@taeyun").accessToken,
            key,
            TransferRequest(pointTypeId = publicPointTypeId(), toId = publicId(recipient), amount = BigDecimal(2_000)),
        )

        assertEquals(HttpStatus.CREATED, mine.statusCode)
        assertEquals(HttpStatus.CREATED, theirs.statusCode, "남의 키에 걸려 500 이 나가면 안 된다")
        assertEquals(2, transferRepository.count(), "각자 하나씩 생긴다")
        assertEquals(3_000, balanceOf(recipient))
    }

    // 계약: docs/API.md — 이체는 관여한 사람만 읽는다. by-key 는 남의 것이면 null 이다.
    @Test
    fun `관여하지 않은 사람은 이체를 id 로도 키로도 읽지 못한다`() {
        giveBalance(issuer, 100_000)
        val key = UUID.randomUUID().toString()
        val created = postTransfer(
            login("@minho").accessToken,
            key,
            TransferRequest(pointTypeId = publicPointTypeId(), toId = publicId(recipient), amount = BigDecimal(1_000)),
        )
        val transferId = assertNotNull(transferIdOf(created.body))

        val outsider = userRepository.save(user("@taeyun", "박태윤"))
        assertNotNull(outsider.id)
        val outsiderToken = login("@taeyun").accessToken
        val headers = HttpHeaders().apply { setBearerAuth(outsiderToken) }

        val byId = restTemplate.exchange("/api/transfers/$transferId", HttpMethod.GET, HttpEntity<Void>(headers), String::class.java)
        assertEquals(HttpStatus.NOT_FOUND, byId.statusCode, "남의 이체는 없는 것과 같은 404 여야 한다")

        // 403 이면 "그 키는 존재한다"를 알려 주는 셈이다. 없을 때와 구별되면 안 된다.
        val byKey = restTemplate.exchange(
            "/api/transfers/by-key?idempotencyKey=$key",
            HttpMethod.GET,
            HttpEntity<Void>(headers),
            String::class.java,
        )
        assertEquals(HttpStatus.OK, byKey.statusCode)
        // 빈 본문이 아니라 리터럴 null 이어야 한다 — 빈 본문은 JSON 이 아니라 클라이언트 파싱이 깨진다.
        assertEquals("null", byKey.body?.trim(), "남의 것이면 JSON null 이어야 한다")

        // 받는 쪽은 id 로는 읽지만 키로는 못 읽는다 — 키는 보낸 쪽의 것이고 받는 쪽은 알 수 없다.
        val recipientHeaders = HttpHeaders().apply { setBearerAuth(login("@jisoo").accessToken) }
        val byIdAsRecipient = restTemplate.exchange(
            "/api/transfers/$transferId",
            HttpMethod.GET,
            HttpEntity<Void>(recipientHeaders),
            String::class.java,
        )
        assertEquals(HttpStatus.OK, byIdAsRecipient.statusCode, "받은 쪽은 관여했으므로 id 로 읽는다")

        val sender = restTemplate.exchange(
            "/api/transfers/by-key?idempotencyKey=$key",
            HttpMethod.GET,
            HttpEntity<Void>(HttpHeaders().apply { setBearerAuth(login("@minho").accessToken) }),
            String::class.java,
        )
        assertEquals(transferId, transferIdOf(sender.body), "보낸 쪽은 자기 키로 확인할 수 있어야 한다")
    }

    // 계약: docs/API.md — by-key 는 없을 때 404 가 아니라 null 이다. 여정 6 의 유일한 확인 수단이라
    // 「안 일어났다」가 정확히 재시도해야 하는 경우이고, 거기서 본문이 비면 회복 경로가 깨진다.
    @Test
    fun `by-key 는 없을 때 빈 본문이 아니라 리터럴 null 을 준다`() {
        val headers = HttpHeaders().apply { setBearerAuth(login("@minho").accessToken) }
        val response = restTemplate.exchange(
            "/api/transfers/by-key?idempotencyKey=${UUID.randomUUID()}",
            HttpMethod.GET,
            HttpEntity<Void>(headers),
            String::class.java,
        )

        assertEquals(HttpStatus.OK, response.statusCode)
        assertEquals("null", response.body?.trim(), "빈 본문이면 클라이언트의 JSON 파싱이 깨진다")
    }

    // 계약: docs/API.md 「엔드포인트」 + docs/JOURNEY.md 여정 9
    @Test
    fun `같은 멱등성 키로 동시에 창설해도 포인트는 하나만 생긴다`() {
        val token = login("@minho").accessToken
        val key = UUID.randomUUID().toString()
        val before = pointTypeRepository.count()

        val responses = inParallel(8) {
            postPointType(token, key, CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000), "public"))
        }

        assertTrue(responses.all { it.statusCode.is2xxSuccessful }, "전부 성공 응답이어야 한다: ${responses.map { it.statusCode }}")
        assertEquals(before + 1, pointTypeRepository.count(), "포인트는 정확히 하나만 생겨야 한다")
        assertEquals(1, responses.mapNotNull { publicIdOf(it.body) }.toSet().size, "모두 같은 포인트를 돌려받아야 한다")
    }

    // 계약: docs/API.md — 이모지는 겹쳐도 된다. 유일하게 두면 먼저 만든 사람이 차지하는 경주가 된다.
    @Test
    fun `같은 이모지로 동시에 창설해도 전부 만들어진다`() {
        val token = login("@minho").accessToken
        val before = pointTypeRepository.count()

        val responses = inParallel(6) {
            postPointType(token, UUID.randomUUID().toString(), CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000), "public"))
        }

        assertEquals(6, responses.count { it.statusCode == HttpStatus.CREATED }, "겹쳐도 막지 않는다: ${responses.map { it.statusCode }}")
        assertEquals(before + 6, pointTypeRepository.count())
    }

    // 계약: docs/API.md — 상한 변경은 발행이 상한을 읽을 때와 같은 행을 잠근다.
    // 확인하는 동안 발행이 끼어들면 확인은 통과하고 결과는 유통량이 상한을 넘은 상태가 된다.
    @Test
    fun `상한을 낮추는 것과 발행이 겹쳐도 유통량이 상한을 넘지 않는다`() {
        pointType.totalIssued = 500_000
        pointTypeRepository.save(pointType)
        val token = login("@minho").accessToken

        // 상한을 발행량까지 낮추는 요청과, 여유를 쓰는 발행을 같은 순간에 보낸다.
        val pool = java.util.concurrent.Executors.newFixedThreadPool(2)
        val ready = CountDownLatch(2)
        val go = CountDownLatch(1)
        val lower = pool.submit<ResponseEntity<String>> {
            ready.countDown(); go.await()
            patchCap(token, UUID.randomUUID().toString(), BigDecimal(500_000))
        }
        val issue = pool.submit<ResponseEntity<String>> {
            ready.countDown(); go.await()
            postIssue(token, UUID.randomUUID().toString(), TransferRequest(pointTypeId = publicPointTypeId(), amount = BigDecimal(400_000)))
        }
        assertTrue(ready.await(10, TimeUnit.SECONDS))
        go.countDown()
        lower.get(30, TimeUnit.SECONDS)
        issue.get(30, TimeUnit.SECONDS)
        pool.shutdown()

        val after = pointTypeRepository.findById(pointType.id!!).orElseThrow()
        assertTrue(
            after.totalIssued <= after.issueCap,
            "유통량이 상한을 넘었다: ${after.totalIssued} > ${after.issueCap}",
        )
    }

    @Test
    fun `같은 키로 동시에 상한을 바꿔도 한 번만 바뀐다`() {
        val token = login("@minho").accessToken
        val key = UUID.randomUUID().toString()

        val responses = inParallel(6) { patchCap(token, key, BigDecimal(2_000_000)) }

        assertTrue(responses.all { it.statusCode.is2xxSuccessful }, "전부 성공 응답이어야 한다: ${responses.map { it.statusCode }}")
        assertEquals(1, capChangeRepository.count(), "이력은 한 줄만 남아야 한다")
        assertEquals(2_000_000, pointTypeRepository.findById(pointType.id!!).orElseThrow().issueCap)
    }

    // 계약: docs/API.md — 쓰기는 멱등성 키를 상태 검사보다 먼저 본다.
    // 응답이 유실돼 다시 누르면 상태가 이미 바뀌어 있고, 상태를 먼저 보면
    // 이미 일어난 일을 안 일어났다고 답하게 된다.
    @Test
    fun `상한 변경을 같은 키로 다시 보내면 그 사이 상태가 바뀌었어도 그때의 결과를 준다`() {
        val token = login("@minho").accessToken
        val key = UUID.randomUUID().toString()

        val first = patchCap(token, key, BigDecimal(2_000_000))
        assertEquals(HttpStatus.OK, first.statusCode)

        // 응답이 유실됐다고 치고 같은 키로 다시. 이제 상한은 이미 200만이라
        // 「지금과 같은 값」 검사를 먼저 하면 400 이 된다.
        val replay = patchCap(token, key, BigDecimal(2_000_000))
        assertEquals(HttpStatus.OK, replay.statusCode, "이미 성공한 요청을 400 으로 되돌리면 안 된다")
        assertEquals(1, capChangeRepository.count(), "이력은 한 줄이다")
    }

    @Test
    fun `창설을 같은 키로 다시 보내면 자기가 만든 기호에 SYMBOL_TAKEN 이 나지 않는다`() {
        val token = login("@minho").accessToken
        val key = UUID.randomUUID().toString()
        val body = CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000), "public")

        val first = postPointType(token, key, body)
        assertEquals(HttpStatus.CREATED, first.statusCode)

        val replay = postPointType(token, key, body)
        assertEquals(HttpStatus.OK, replay.statusCode, "자기가 방금 만든 것에 SYMBOL_TAKEN 이 나면 안 된다")
        assertEquals(publicIdOf(first.body), publicIdOf(replay.body))
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

    private fun publicIdOf(body: String?) = transferIdOf(body)

    private fun patchCap(token: String, key: String, cap: BigDecimal): ResponseEntity<String> {
        val headers = HttpHeaders().apply {
            setBearerAuth(token)
            set("Idempotency-Key", key)
        }
        return restTemplate.exchange(
            "/api/point-types/" + publicPointTypeId() + "/cap",
            HttpMethod.PATCH,
            HttpEntity(ChangeCapRequest(cap), headers),
            String::class.java,
        )
    }

    private fun postPointType(token: String, key: String, body: CreatePointTypeRequest): ResponseEntity<String> {
        val headers = HttpHeaders().apply {
            setBearerAuth(token)
            set("Idempotency-Key", key)
        }
        return restTemplate.exchange("/api/point-types", HttpMethod.POST, HttpEntity(body, headers), String::class.java)
    }

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

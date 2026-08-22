package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.transfer.TransferRequest
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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * 커넥션 절벽. 요청 경로에서 커넥션을 하나 더 꺼내면(`REQUIRES_NEW`) 동시 요청이 풀 크기에
 * 닿는 순간 전부가 두 번째를 기다리며 서로를 막고, 30 초 뒤 `connectionTimeout` 으로 한꺼번에
 * 500 이다 — 기울기가 아니라 절벽이다. 그래서 **풀을 둘로 줄이면 여덟 발로 재현된다.**
 *
 * 풀 크기를 이 클래스에만 건다. 전체에 걸면 다른 테스트가 다 같이 느려지고, 안 걸면 기본 10
 * 이라 여덟 발로는 절벽에 닿지 않아 이 검사가 조용히 아무것도 안 보게 된다.
 *
 * 근거: docs/LEDGER.md 「커넥션」.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = ["spring.datasource.hikari.maximum-pool-size=2"],
)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class ConnectionCliffTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var bankFixture: BankFixture
    @Autowired lateinit var ledgerFixture: LedgerFixture
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private lateinit var issuer: User
    private lateinit var pointType: PointType

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()
        issuer = save("@minho", "장민호")
        pointType = bankFixture.open(
            PointType(
                name = "금머니",
                emoji = "🎁",
                issuer = issuer,
                accent = PointAccent.PURPLE,
                visibility = PointVisibility.PUBLIC,
            ),
        )
    }

    @Test
    fun `계정이 없는 상대에게 동시에 여덟 발을 쏴도 서지 않는다`() {
        ledgerFixture.issue(pointType, 100_000)
        val token = login().accessToken
        // 아무도 이 포인트의 계정이 없다 — 예전에는 여기서 별도 트랜잭션이 열렸다.
        val newcomers = List(8) { save("@new$it", "새사람$it") }

        val started = System.nanoTime()
        val responses = inParallel(8) { index ->
            post(token, TransferRequest(pointTypeId = pointType.publicId.toString(), toId = newcomers[index].publicId.toString(), amount = BigDecimal(1_000)))
        }
        val elapsed = (System.nanoTime() - started) / 1_000_000

        assertTrue(
            responses.all { it.statusCode == HttpStatus.CREATED },
            "받는 사람의 계정이 없다고 서면 안 된다: ${responses.map { it.statusCode }}",
        )
        assertTrue(elapsed < 10_000, "커넥션을 기다린 흔적이다 — 절벽 앞에서는 30 초다: ${elapsed}ms")
    }

    private fun post(token: String, body: TransferRequest): ResponseEntity<String> {
        val headers = HttpHeaders().apply {
            setBearerAuth(token)
            set("Idempotency-Key", UUID.randomUUID().toString())
        }
        return restTemplate.exchange("/api/transfers", HttpMethod.POST, HttpEntity(body, headers), String::class.java)
    }

    private fun save(handle: String, name: String) =
        userRepository.save(User(name = name, handle = handle, passwordHash = passwordEncoder.encode("point")!!))

    private fun login(): LoginResponse = assertNotNull(
        restTemplate.postForEntity("/api/auth/login", LoginRequest("@minho", "point"), LoginResponse::class.java).body,
    )

    /** 모든 요청이 같은 순간에 출발하게 맞춘다 — 어긋나면 절벽이 시험되지 않는다. */
    private fun inParallel(count: Int, call: (Int) -> ResponseEntity<String>): List<ResponseEntity<String>> {
        val pool = Executors.newFixedThreadPool(count)
        val ready = CountDownLatch(count)
        val go = CountDownLatch(1)
        val futures = List(count) { index ->
            pool.submit<ResponseEntity<String>> {
                ready.countDown()
                go.await()
                call(index)
            }
        }
        assertTrue(ready.await(10, TimeUnit.SECONDS))
        go.countDown()
        val results = futures.map { it.get(60, TimeUnit.SECONDS) }
        pool.shutdown()
        return results
    }
}

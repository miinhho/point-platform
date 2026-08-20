package io.github.miinhho.point

import io.github.miinhho.point.auth.LoginRequest
import io.github.miinhho.point.auth.LoginResponse
import io.github.miinhho.point.ledger.Account
import io.github.miinhho.point.ledger.AccountKind
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.CreatePointTypeRequest
import io.github.miinhho.point.pointtype.PointAccent
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.TestRestTemplate
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import java.math.BigDecimal
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** 계정: docs/LEDGER.md 「계정」. 보유자 계정은 받을 때 생기고, 발행 계정은 창설과 함께 난다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration::class)
class AccountsTest {
    @Autowired lateinit var ledgerReset: LedgerReset
    @Autowired lateinit var restTemplate: TestRestTemplate
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var pointTypeRepository: PointTypeRepository
    @Autowired lateinit var accountRepository: AccountRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private lateinit var issuer: User

    @BeforeEach
    fun seed() {
        ledgerReset.wipe()
        issuer = userRepository.save(
            User(name = "장민호", handle = "@minho", passwordHash = passwordEncoder.encode("point")!!),
        )
    }

    @Test
    fun `창설하면 발행 계정이 잔액 0 으로 함께 난다`() {
        val created = createPointType()
        assertEquals(HttpStatus.CREATED, created.statusCode, created.body)

        val accounts = accountRepository.findAll()
        assertEquals(1, accounts.size, "창설만으로는 보유자 계정이 나지 않는다")

        assertEveryPointTypeHasIssuance()
        val issuance = accounts.single()
        assertEquals(AccountKind.ISSUANCE, issuance.kind)
        assertEquals(0, issuance.balance)
        // 발행 계정은 포인트의 것이지 사람의 것이 아니다.
        assertNull(issuance.user)
    }

    @Test
    fun `보유자 없는 보유자 계정은 만들 수 없다`() {
        createPointType()
        val pointType = pointTypeRepository.findAll().single()

        // holder_key 가 0 이 되어 그 포인트의 발행 계정 자리를 먹는다.
        assertThrows<DataIntegrityViolationException> {
            accountRepository.saveAndFlush(
                Account(pointType = pointType, user = null, kind = AccountKind.HOLDER),
            )
        }
    }

    @Test
    fun `한 포인트에 발행 계정이 둘 생길 수 없다`() {
        createPointType()
        val pointType = pointTypeRepository.findAll().single()

        // 상한을 보는 쪽이 잠글 행이라 둘이면 서로 다른 행을 잠그고 상한이 뜻을 잃는다.
        assertThrows<DataIntegrityViolationException> {
            accountRepository.saveAndFlush(
                Account(pointType = pointType, user = null, kind = AccountKind.ISSUANCE),
            )
        }
    }

    // 깨지면 상한을 보는 쪽이 잠글 행을 못 찾는다.
    private fun assertEveryPointTypeHasIssuance() {
        val withIssuance = accountRepository.findAll()
            .filter { it.kind == AccountKind.ISSUANCE }
            .mapNotNull { it.pointType.id }
            .toSet()
        val missing = pointTypeRepository.findAll().mapNotNull { it.id }.filterNot { it in withIssuance }
        assertEquals(emptyList(), missing, "발행 계정 없는 포인트가 있다")
    }

    private fun createPointType(): ResponseEntity<String> {
        val headers = HttpHeaders().apply {
            setBearerAuth(token())
            set("Idempotency-Key", UUID.randomUUID().toString())
        }
        val body = CreatePointTypeRequest("동네빵집", "🍞", null, "orange", BigDecimal(1_000_000), "public")
        return restTemplate.exchange("/api/point-types", HttpMethod.POST, HttpEntity(body, headers), String::class.java)
    }

    private fun token(): String = assertNotNull(
        restTemplate.postForEntity("/api/auth/login", LoginRequest("@minho", "point"), LoginResponse::class.java).body,
    ).accessToken
}

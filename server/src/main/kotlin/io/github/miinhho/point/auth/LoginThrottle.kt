package io.github.miinhho.point.auth

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

/**
 * 문구를 같게 두는 것은 존재를 감출 뿐 암호를 지키지 못한다. 방어는 시도 제한이 한다.
 *
 * 핸들과 IP 를 함께 센다 — 핸들만 세면 남의 계정을 일부러 잠글 수 있고, IP 만 세면 분산
 * 시도에 뚫린다.
 */
@Service
class LoginThrottle(private val jdbc: JdbcClient) {
    fun isLocked(handle: String, ip: String): Boolean =
        failuresIn(handleScope(handle)) >= HANDLE_LIMIT || failuresIn(ipScope(ip)) >= IP_LIMIT

    /**
     * 실패를 센다. 잠금은 실패의 결과이므로 로그인 트랜잭션과 함께 되돌아가면 안 된다 —
     * 그래서 별도 트랜잭션이다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun recordFailure(handle: String, ip: String) {
        listOf(handleScope(handle), ipScope(ip)).forEach(::bump)
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun clear(handle: String, ip: String) {
        jdbc.sql("delete from login_failures where scope in (:scopes)")
            .param("scopes", listOf(handleScope(handle), ipScope(ip)))
            .update()
    }

    // 읽고 더해 쓰지 않는다 — 동시에 온 실패가 서로를 덮으면 세는 의미가 없다.
    // 창이 지났으면 같은 문장이 1 부터 다시 시작한다.
    private fun bump(scope: String) = jdbc.sql(
        """insert into login_failures (scope, failures, window_started_at) values (:scope, 1, :now)
           on duplicate key update
             failures = if(window_started_at < :windowStart, 1, failures + 1),
             window_started_at = if(window_started_at < :windowStart, :now, window_started_at)""",
    ).param("scope", scope).param("now", Instant.now()).param("windowStart", Instant.now().minus(WINDOW)).update()

    private fun failuresIn(scope: String): Int = jdbc.sql(
        "select failures from login_failures where scope = :scope and window_started_at >= :windowStart",
    ).param("scope", scope).param("windowStart", Instant.now().minus(WINDOW))
        .query(Int::class.java).optional().orElse(0)

    private fun handleScope(handle: String) = "handle:$handle".take(120)

    private fun ipScope(ip: String) = "ip:$ip".take(120)

    private companion object {
        val WINDOW: Duration = Duration.ofMinutes(15)

        // 사람이 오타로 넘길 수 있는 수보다 넉넉하고, 찍어 보기에는 턱없이 적다.
        const val HANDLE_LIMIT = 10
        const val IP_LIMIT = 50
    }
}

package io.github.miinhho.point.ledger

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

/**
 * 발행 계정 없는 포인트가 있으면 부팅을 세운다.
 *
 * 스키마로 강제할 수 없다 — 트리거는 binlog 가 켜진 MySQL 에서 SUPER 를 요구하고 그것은
 * 앱 사용자에게 줄 권한이 아니다. 그래서 성질이 호출부의 규율에 걸려 있고, 규율은 조용히
 * 깨진다. 실제로 시드가 한 번 빠뜨렸고 실서버에 띄워 보고서야 알았다.
 *
 * 시드 전부보다 뒤에 선다. ApplicationRunner 는 「Started PointApplicationKt」가 찍힌 뒤에 돌므로
 * **부팅을 세우는 것이 아니라 잠깐 살았다가 죽인다** — 그 사이 Tomcat 은 이미 듣고 있고,
 * 로그에서는 성공 줄 다음에 실패가 온다.
 */
@Component
@Order(3)
class IssuanceAccountGuard(private val accountRepository: AccountRepository) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val missing = accountRepository.pointTypeIdsWithoutIssuance()
        check(missing.isEmpty()) {
            "발행 계정 없는 포인트가 있다: $missing. 포인트를 만드는 길 하나가 계정을 열지 않는다."
        }
    }
}

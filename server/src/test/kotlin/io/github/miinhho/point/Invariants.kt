package io.github.miinhho.point

import io.github.miinhho.point.ledger.AccountKind
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.PointTypeRepository
import org.junit.jupiter.api.extension.AfterEachCallback
import org.junit.jupiter.api.extension.ExtensionContext
import org.springframework.context.ApplicationContext
import org.springframework.test.context.junit.jupiter.SpringExtension
import kotlin.test.assertEquals

/**
 * 판 전체에 걸린 불변식을 **모든 테스트가 끝날 때** 본다. 클래스 안에서 부르면 그 클래스가
 * 스스로 만든 행만 보이고, 다른 데서 깨뜨린 코드는 그 테스트가 초록인 채로 지나간다.
 *
 * 자동 등록이라 붙이는 것을 잊을 자리가 없다 — `junit-platform.properties` 와
 * `META-INF/services` 가 짝이다.
 */
class Invariants : AfterEachCallback {
    override fun afterEach(context: ExtensionContext) {
        // 볼 것이 없는 테스트가 있다 — 스프링을 안 띄우는 것(계약 파싱)과, 띄우되
        // 리포지토리가 없는 것(부팅 가드처럼 컨텍스트만 세우는 것)이다.
        val spring = runCatching { SpringExtension.getApplicationContext(context) }.getOrNull() ?: return
        val pointTypes = spring.bean(PointTypeRepository::class.java) ?: return

        everyPointTypeHasIssuanceAccount(spring, pointTypes)
    }

    /** 깨지면 상한을 보는 쪽이 잠글 행을 못 찾는다. */
    private fun everyPointTypeHasIssuanceAccount(spring: ApplicationContext, pointTypes: PointTypeRepository) {
        val accounts = spring.bean(AccountRepository::class.java) ?: return
        // 지연 프록시의 식별자는 초기화 없이 읽힌다.
        val withIssuance = accounts.findAll()
            .filter { it.kind == AccountKind.ISSUANCE }
            .mapNotNull { it.pointType.id }
            .toSet()
        val missing = pointTypes.findAll().mapNotNull { it.id }.filterNot { it in withIssuance }
        assertEquals(emptyList(), missing, "발행 계정 없는 포인트가 있다")
    }

    private fun <T : Any> ApplicationContext.bean(type: Class<T>): T? = getBeanProvider(type).getIfAvailable()
}

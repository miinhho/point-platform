package io.github.miinhho.point

import io.github.miinhho.point.ledger.AccountKind
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.PointTypeRepository
import org.junit.jupiter.api.extension.AfterEachCallback
import org.junit.jupiter.api.extension.ExtensionContext
import org.springframework.context.ApplicationContext
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.test.context.BootstrapWith
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
        // 스프링 테스트가 아닌 것이 있다 — 계약 파싱과 상수 비교. 볼 판이 없다.
        // 컨텍스트 유무로는 못 가른다: SpringExtension 은 애너테이션이 없는 클래스에도
        // 빈 컨텍스트를 만들어 준다.
        val testClass = context.testClass.orElse(null) ?: return
        if (AnnotatedElementUtils.findMergedAnnotation(testClass, BootstrapWith::class.java) == null) return

        everyPointTypeHasIssuanceAccount(SpringExtension.getApplicationContext(context))
    }

    /** 깨지면 상한을 보는 쪽이 잠글 행을 못 찾는다. */
    private fun everyPointTypeHasIssuanceAccount(spring: ApplicationContext) {
        // 지연 프록시의 식별자는 초기화 없이 읽힌다.
        val withIssuance = spring.repository(AccountRepository::class.java).findAll()
            .filter { it.kind == AccountKind.ISSUANCE }
            .mapNotNull { it.pointType.id }
            .toSet()
        val missing = spring.repository(PointTypeRepository::class.java).findAll()
            .mapNotNull { it.id }
            .filterNot { it in withIssuance }
        assertEquals(emptyList(), missing, "발행 계정 없는 포인트가 있다")
    }

    // 스프링이 떴는데 리포지토리가 없는 것은 「볼 것이 없다」가 아니라 설정이 바뀐 것이다.
    // 조용히 넘기면 이 검사가 꺼진 것과 볼 것이 없는 것이 같아 보인다.
    private fun <T : Any> ApplicationContext.repository(type: Class<T>): T =
        getBeanProvider(type).getIfAvailable()
            ?: error("${type.simpleName} 없이 스프링이 떴다 — 불변식이 볼 판을 잃었다")
}

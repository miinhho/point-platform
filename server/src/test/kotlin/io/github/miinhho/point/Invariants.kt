package io.github.miinhho.point

import io.github.miinhho.point.ledger.AccountKind
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.ledger.PostingRepository
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
 * `META-INF/services` 가 짝이다. 근거: docs/LEDGER.md 「불변식」.
 *
 * **문서의 다섯 중 넷만 여기 있다.** 「보유자 잔액은 음수가 아니다」는 스키마 CHECK 가,
 * 「발행 총량은 상한을 넘지 않는다」는 적용부가 잠금 아래에서 지킨다 — 불변식은 길을 하나로
 * 만드는 것이 제일 위이고 그다음이 스키마다. 더 위에서 막은 것을 테스트로 한 벌 더 적으면
 * 그것이 중복이고, 둘 중 한쪽이 곧 거짓이 된다.
 */
class Invariants : AfterEachCallback {
    override fun afterEach(context: ExtensionContext) {
        // 스프링 테스트가 아닌 것이 있다 — 계약 파싱과 상수 비교. 볼 판이 없다.
        // 컨텍스트 유무로는 못 가른다: SpringExtension 은 애너테이션이 없는 클래스에도
        // 빈 컨텍스트를 만들어 준다.
        val testClass = context.testClass.orElse(null) ?: return
        if (AnnotatedElementUtils.findMergedAnnotation(testClass, BootstrapWith::class.java) == null) return

        val spring = SpringExtension.getApplicationContext(context)
        val accounts = spring.repository(AccountRepository::class.java)
        val postings = spring.repository(PostingRepository::class.java)

        everyPointTypeHasIssuanceAccount(accounts, spring.repository(PointTypeRepository::class.java))
        everyEntryBalances(postings)
        everyPointTypeBalances(postings)
        everyBalanceIsTheSumOfItsPostings(accounts, postings)
    }

    /** 깨지면 상한을 보는 쪽이 잠글 행을 못 찾는다. */
    private fun everyPointTypeHasIssuanceAccount(accounts: AccountRepository, pointTypes: PointTypeRepository) {
        // 지연 프록시의 식별자는 초기화 없이 읽힌다.
        val withIssuance = accounts.findAll()
            .filter { it.kind == AccountKind.ISSUANCE }
            .mapNotNull { it.pointType.id }
            .toSet()
        val missing = pointTypes.findAll().mapNotNull { it.id }.filterNot { it in withIssuance }
        assertEquals(emptyList(), missing, "발행 계정 없는 포인트가 있다")
    }

    /** 복식이다 — 한 사건은 어디선가 나와 어디론가 간다. */
    private fun everyEntryBalances(postings: PostingRepository) =
        assertEquals(emptyList(), postings.entriesOutOfBalance().map { it.render() }, "전기 합이 0 이 아닌 사건이 있다")

    /** 발행 계정이 보유자 잔액의 반대편이므로 포인트마다도 0 이다. */
    private fun everyPointTypeBalances(postings: PostingRepository) =
        assertEquals(emptyList(), postings.pointTypesOutOfBalance().map { it.render() }, "전기 합이 0 이 아닌 포인트가 있다")

    /** 잔액은 전기의 합을 접어 둔 것이다 — 접은 값과 편 값이 다르면 잔액이 거짓말한다. */
    private fun everyBalanceIsTheSumOfItsPostings(accounts: AccountRepository, postings: PostingRepository) {
        val sums = postings.sumsByAccount().associate { it[0] as Long to it[1] as Long }
        val wrong = accounts.findAll()
            .filter { it.balance != (sums[it.id] ?: 0L) }
            .map { "계정 ${it.id}: 잔액 ${it.balance} ≠ 전기 합 ${sums[it.id] ?: 0L}" }
        assertEquals(emptyList(), wrong, "잔액이 전기의 합과 다르다")
    }

    private fun Array<Any>.render() = "${this[0]}: ${this[1]}"

    // 스프링이 떴는데 리포지토리가 없는 것은 「볼 것이 없다」가 아니라 설정이 바뀐 것이다.
    // 조용히 넘기면 이 검사가 꺼진 것과 볼 것이 없는 것이 같아 보인다.
    private fun <T : Any> ApplicationContext.repository(type: Class<T>): T =
        getBeanProvider(type).getIfAvailable()
            ?: error("${type.simpleName} 없이 스프링이 떴다 — 불변식이 볼 판을 잃었다")
}

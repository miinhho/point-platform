package io.github.miinhho.point

import org.junit.jupiter.api.Test
import org.springframework.modulith.core.ApplicationModules

/**
 * 모듈 경계를 **타입 그래프로** 검사한다. `DisciplineTest` 가 소스 문자열을 보는 것과 달리
 * 여기는 실제 의존을 보므로, 이름을 바꾸거나 우회해도 빠져나갈 자리가 없다.
 *
 * 순환을 잡는 것이 이 검사의 값이다 — 순환은 「두 개념이 사실은 하나」이거나 「기반이 위를
 * 참조한다」는 뜻이고, 둘 다 이름을 고쳐서는 사라지지 않는다.
 *
 * 이벤트와 아웃박스는 쓰지 않는다. 원장의 핵심은 사건·전기·잔액이 **한 트랜잭션**이라는
 * 것이고, 모듈 사이를 이벤트로 잇는 관용구는 그것을 최종 일관성으로 끌고 간다.
 */
class ModulesTest {
    @Test
    fun `모듈 경계가 지켜진다`() {
        ApplicationModules.of(PointApplication::class.java).verify()
    }
}

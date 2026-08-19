package io.github.miinhho.point

import io.github.miinhho.point.shared.FailureCode
import org.junit.jupiter.api.Test
import java.nio.file.Path
import kotlin.io.path.readText
import kotlin.test.assertTrue

/**
 * 서버가 실패 코드를 하나 더하고 계약에 넣지 않으면, 클라이언트는 모르는 코드를 `SERVER` 로
 * 떨어뜨린다. 그러면 화면은 「서버에 문제가 생겼어요」라고 말하고, 사용자는 **자기가 고칠 수
 * 있는 실패**(회원이 아니다·상한을 넘었다)를 앱 고장으로 읽는다.
 *
 * 저장소에 실제로 난 사고다 (`REVIEW.md`). 웹은 세 벌을 한 출처에 묶어 두었는데 언어 경계만
 * 손으로 맞춰지고 있었다.
 *
 * 방향이 한쪽이다 — **서버에 있는 것은 계약에 있어야 한다.** 반대는 미구현일 뿐이라 막지 않는다.
 */
class FailureCodeContractTest {
    @Test
    fun `서버가 만드는 실패 코드는 전부 계약에 있다`() {
        val contract = contractCodes()
        assertTrue(contract.size > 5, "계약 표를 못 읽었다. 파싱이 깨졌으면 이 테스트는 아무것도 지키지 않는다")

        // NETWORK 은 응답이 아니라 요청이 닿지 못한 것이라 서버가 만들 수 없다.
        val extra = FailureCode.entries.map { it.name } - contract
        assertTrue(extra.isEmpty(), "계약에 없는 코드를 서버가 만든다: $extra — 클라이언트는 이것을 SERVER 로 읽는다")
    }

    // 실패 표의 줄과, 인증 절처럼 본문에 박힌 `"code": "X"` 를 함께 읽는다 —
    // 표에 없는 코드가 둘 있어서(BAD_CREDENTIALS·UNAUTHENTICATED) 표만 보면 거짓 실패가 난다.
    private fun contractCodes(): Set<String> {
        val doc = Path.of("..", "docs", "API.md").readText()
        val inTable = Regex("^\\| `([A-Z_]+)` \\|", RegexOption.MULTILINE).findAll(doc)
        val inProse = Regex("\"code\":\\s*\"([A-Z_]+)\"").findAll(doc)
        return (inTable + inProse).map { it.groupValues[1] }.toSet()
    }
}

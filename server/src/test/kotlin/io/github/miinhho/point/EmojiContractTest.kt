package io.github.miinhho.point

import io.github.miinhho.point.pointtype.AllowedEmoji
import org.junit.jupiter.api.Test
import java.nio.file.Path
import kotlin.io.path.readText
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * 서버가 더 느슨하면 화면이 아니라 SDK·curl 로 목록 밖 표식이 들어오고, **포인트는 지울 수
 * 없어서** 그 표식이 원장과 받은 사람들의 지갑에 영구히 남는다. 화면이 라디오로 좁히는 것은
 * 방어가 아니다.
 */
class EmojiContractTest {
    @Test
    fun `서버의 허용 목록이 계약과 같다`() {
        val fenced = Path.of("..", "docs", "API.md").readText()
            .substringAfter("**허용 목록은 이것이다.**").substringAfter("```").substringBefore("```")
        val contract = fenced.split(Regex("\\s+")).filter { it.isNotBlank() }.toSet()

        assertEquals(60, contract.size, "계약 목록을 못 읽었다. 파싱이 깨지면 이 테스트는 아무것도 지키지 않는다")
        assertEquals(contract, AllowedEmoji.all)
    }

    @Test
    fun `이형 선택자가 붙든 안 붙든 한 모양으로 받는다`() {
        // ✏(U+270F)와 ✏️(U+270F U+FE0F)는 길이로 갈리지 않는다.
        assertEquals("✏️", AllowedEmoji.normalize("✏"))
        assertEquals("✏️", AllowedEmoji.normalize("✏️"))
        assertEquals("🍞", AllowedEmoji.normalize(" 🍞 "))
    }

    @Test
    fun `목록 밖은 받지 않는다`() {
        // 피부색·ZWJ·국기 — 기기마다 너비와 폰트 대체가 갈리는 것들이다.
        listOf("👍🏽", "👨‍👩‍👧", "🇰🇷", "🍞🍞", "", "x").forEach {
            assertTrue(AllowedEmoji.normalize(it) == null, "목록 밖이다: $it")
        }
    }
}

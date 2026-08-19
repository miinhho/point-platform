package io.github.miinhho.point.pointtype

/**
 * 계약: docs/API.md 창설 절. 화면과 같은 목록이고 `EmojiContractTest` 가 대조한다.
 *
 * 목록으로 두는 이유는 **모든 기기에서 같게 보이는 것만 고르게** 하기 위해서다. 길이로
 * 검사할 수 없다 — 이모지는 결합된 여러 코드포인트일 수 있어 「한 글자」가 코드포인트
 * 하나가 아니다.
 */
object AllowedEmoji {
    private val VALUES = setOf(
        "🍞", "🍰", "🍜", "🍕", "🍔", "🍣", "☕", "🍺", "🧃", "🍎", "🥕", "🌽",
        "🏪", "🏬", "🏫", "🏥", "🏦", "🎪", "🎨", "🎬", "🎮", "🎵", "📚", "✏️",
        "🚲", "🚌", "🧺", "🪴", "🌱", "🌊", "🔥", "⭐", "🌙", "☀️", "⛰️", "🧭",
        "🐶", "🐱", "🐰", "🐻", "🐼", "🦊", "🐧", "🐢", "🐝", "🦋", "🐟", "🌸",
        "⚽", "🏀", "🎾", "🏐", "🎯", "🎲", "🧩", "🎁", "💡", "🔧", "🗝️", "🔔",
    )

    val all: Set<String> get() = VALUES

    /**
     * 정규화한 형태 하나만 받는다. `✏`(U+270F)와 `✏️`(U+270F U+FE0F)는 길이로 갈리지 않고,
     * 둘을 다 받으면 같은 표식이 두 모양으로 원장에 남는다 — 포인트는 지울 수 없다.
     */
    fun normalize(raw: String): String? {
        val trimmed = raw.trim()
        return VALUES.firstOrNull { it == trimmed || it.filterNot(::isVariationSelector) == trimmed }
    }

    private fun isVariationSelector(c: Char) = c.code in 0xFE00..0xFE0F
}

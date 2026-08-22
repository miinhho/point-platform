package io.github.miinhho.point.shop

/**
 * 본문에 키가 있었는가. **없는 것과 `null` 은 다르다** — 수정에서 빠진 것은 「그대로
 * 둔다」이고 `null` 은 「제한을 없앤다」다. 하나의 `null` 로 받으면 그 자리에서 구별이
 * 사라지고, 소개만 고치려던 요청이 재고를 무제한으로 바꾼다.
 */
sealed interface Change<out T> {
    data object Keep : Change<Nothing>

    class Set<out T>(val value: T) : Change<T>
}

fun <T> Change<T>.or(current: T): T = when (this) {
    is Change.Keep -> current
    is Change.Set -> value
}

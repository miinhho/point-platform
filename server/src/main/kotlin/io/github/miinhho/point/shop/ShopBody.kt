package io.github.miinhho.point.shop

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import tools.jackson.databind.JsonNode

// JS Number.MAX_SAFE_INTEGER — 프론트가 안전하게 다룰 수 있는 정수 상한. 근거: docs/API.md
const val MAX_SAFE_INTEGER: Long = 9_007_199_254_740_991L

/**
 * 본문을 손으로 읽는다. **HTTP 경계에는 타입이 없다** — 데이터 클래스로 받으면 키가
 * 빠진 것과 `null` 이 같은 값으로 도착하고, 계약이 그 둘을 가르라고 적어 두었다.
 */
fun JsonNode.requiredCount(field: String): Int? {
    val node = get(field) ?: throw malformed(field)
    if (node.isNull) return null
    return count(node) ?: throw malformed(field)
}

/** 없으면 그대로 둔다. 있으면 값이거나 `null` 이다. */
fun JsonNode.changedCount(field: String): Change<Int?> {
    val node = get(field) ?: return Change.Keep
    if (node.isNull) return Change.Set(null)
    return Change.Set(count(node) ?: throw malformed(field))
}

fun JsonNode.changedText(field: String, max: Int): Change<String?> {
    val node = get(field) ?: return Change.Keep
    if (node.isNull) return Change.Set(null)
    return Change.Set(text(node, field, max))
}

fun JsonNode.optionalText(field: String, max: Int): String? {
    val node = get(field) ?: return null
    if (node.isNull) return null
    return text(node, field, max)
}

fun JsonNode.requiredText(field: String, min: Int, max: Int): String {
    val value = optionalText(field, max) ?: throw malformed(field)
    if (value.filterNot(Char::isWhitespace).length < min) throw malformed(field)
    return value
}

/** 안전 범위의 양의 정수. 소수점이 실려 오면 `400` 이다 — 통과시키면 잔액에 소수가 생긴다. */
fun JsonNode.requiredAmount(field: String): Long {
    val node = get(field) ?: throw malformed(field)
    val value = node.takeIf { it.isNumber }?.decimalValue()
        ?.stripTrailingZeros()?.takeIf { it.scale() <= 0 }
        ?.runCatching { longValueExact() }?.getOrNull()
    if (value == null || value <= 0 || value > MAX_SAFE_INTEGER) throw malformed(field)
    return value
}

// 개수는 Int 다. 재고도 한도도 수량도 사람이 세는 것이라 안전 범위보다 훨씬 작다.
private fun count(node: JsonNode): Int? = node.takeIf { it.isNumber }?.decimalValue()
    ?.stripTrailingZeros()?.takeIf { it.scale() <= 0 }
    ?.runCatching { intValueExact() }?.getOrNull()
    ?.takeIf { it > 0 }

private fun text(node: JsonNode, field: String, max: Int): String {
    val value = node.takeIf { it.isString }?.stringValue()?.trim() ?: throw malformed(field)
    if (value.filterNot(Char::isWhitespace).length > max) throw malformed(field)
    return value
}

private fun malformed(field: String) =
    DomainFailureException(FailureCode.MALFORMED_REQUEST, "$field 이(가) 계약과 다름")

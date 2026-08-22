package io.github.miinhho.point.shop

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.NullNode

@RestController
@RequestMapping("/api")
class PurchaseController(
    private val purchaseService: PurchaseService,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping("/listings/{id}/purchases")
    fun buy(
        @PathVariable id: String,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: JsonNode,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<PurchaseResultResponse> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "Idempotency-Key 없음")
        // 최적화일 뿐 방어가 아니다 — 같은 키가 동시에 오면 둘 다 여기서 없다고 본다.
        purchaseService.findByIdempotencyKey(key, userId)?.let { return ResponseEntity.ok(it) }

        val quantity = body.requiredCount("quantity")
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "quantity 이(가) 계약과 다름")

        val result = try {
            purchaseService.buy(id, userId, key, quantity)
        } catch (e: DataIntegrityViolationException) {
            // 키의 unique 위반은 오류가 아니라 「이미 샀다」다. 되돌릴 경로가 없으므로 두 번 빠지면 안 된다.
            val existing = purchaseService.findByIdempotencyKey(key, userId) ?: throw e
            return ResponseEntity.ok(existing)
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(result)
    }

    /** 남의 것이면 `null` 이다 — 없을 때와 같다. 결과를 못 받은 사람의 유일한 확인 수단이다. */
    @GetMapping("/purchases/by-key")
    fun byKey(
        @RequestParam idempotencyKey: String?,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<JsonNode> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "idempotencyKey 없음")
        val found = purchaseService.findByIdempotencyKey(key, userId)
        // 리터럴 null 을 싣는다 — 그냥 null 을 반환하면 본문이 비고 클라이언트의 파싱이 깨진다.
        val body: JsonNode = found?.let { objectMapper.valueToTree(it) } ?: NullNode.instance
        return ResponseEntity.ok(body)
    }
}

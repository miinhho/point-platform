package io.github.miinhho.point.issue

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

// JS Number.MAX_SAFE_INTEGER — 프론트가 안전하게 다룰 수 있는 정수 상한. 근거: docs/API.md
private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

@RestController
@RequestMapping("/api")
class IssueController(
    private val issueService: IssueService,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping("/issues")
    fun create(
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: IssueRequest,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<IssueResponse> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "Idempotency-Key 없음")

        // 이 조회는 최적화일 뿐 방어가 아니다 — 동시에 온 둘은 여기서 둘 다 없다고 본다.
        issueService.findByIdempotencyKey(key, userId)?.let { return ResponseEntity.ok(it) }

        val amount = body.amount?.let { raw ->
            // scale > 0 이면 소수점이 실려 온 것이다. stripTrailingZeros 로 100.0 은 통과시킨다.
            raw.stripTrailingZeros().takeIf { it.scale() <= 0 }?.runCatching { longValueExact() }?.getOrNull()
        }
        // toId 가 실려 오면 거절한다. 조용히 무시하면 발행자가 잘못 고른 것을 알 방법이 없다.
        val wrong = when {
            body.pointTypeId.isNullOrBlank() -> "pointTypeId"
            amount == null || amount <= 0 || amount > MAX_SAFE_INTEGER -> "amount"
            body.toId != null -> "toId"
            else -> null
        }
        if (wrong != null) throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "$wrong 이(가) 계약과 다름")

        return try {
            ResponseEntity.status(HttpStatus.CREATED)
                .body(issueService.commit(userId, key, body.pointTypeId!!, amount!!))
        } catch (e: DataIntegrityViolationException) {
            // 같은 키가 동시에 왔다 — 두 번 발행하면 상한을 넘고 되돌릴 경로가 없다.
            ResponseEntity.ok(issueService.findByIdempotencyKey(key, userId) ?: throw e)
        }
    }

    @GetMapping("/issues/by-key")
    fun byKey(
        @RequestParam idempotencyKey: String?,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<JsonNode> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "idempotencyKey 없음")
        val found = issueService.findByIdempotencyKey(key, userId)
        // 본문에 리터럴 null 을 싣는다. 그냥 null 을 반환하면 Spring 이 본문을 쓰지 않아
        // 200 + 빈 본문이 되고, 클라이언트의 JSON 파싱이 거기서 깨진다.
        return ResponseEntity.ok(found?.let { objectMapper.valueToTree(it) } ?: NullNode.instance)
    }

    @GetMapping("/issues/{id}")
    fun byId(@PathVariable id: String, @AuthenticationPrincipal userId: Long): IssueResponse =
        issueService.findById(id, userId)
}

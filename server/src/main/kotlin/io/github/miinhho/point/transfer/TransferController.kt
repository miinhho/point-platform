package io.github.miinhho.point.transfer

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.user.UserRepository
import org.springframework.dao.DataIntegrityViolationException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.NullNode
import org.springframework.data.domain.Limit
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

// JS Number.MAX_SAFE_INTEGER — 프론트가 안전하게 다룰 수 있는 정수 상한. 근거: docs/API.md
private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

@RestController
@RequestMapping("/api")
class TransferController(
    private val transferService: TransferService,
    private val transferRepository: TransferRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping("/transfers")
    fun createTransfer(
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: TransferRequest,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<TransferResponse> = commit(idempotencyKey, body, userId)

    @GetMapping("/transfers/by-key")
    @Transactional(readOnly = true)
    fun byKey(
        @RequestParam idempotencyKey: String?,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<JsonNode> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "idempotencyKey 없음")
        // 남의 것이면 null 이다 — 없을 때와 같다. 「추측하기 어렵다」는 접근 제어가 아니다.
        val found = transferService.findByIdempotencyKey(key, userId)
        // 본문에 리터럴 null 을 싣는다. 그냥 null 을 반환하면 Spring 이 본문을 아예 쓰지 않아
        // 200 + 빈 본문이 되고, 클라이언트의 JSON 파싱이 거기서 깨진다.
        val body: JsonNode = found?.let { objectMapper.valueToTree(it) } ?: NullNode.instance
        return ResponseEntity.ok(body)
    }

    // 근거: docs/API.md — 404 는 "안 일어났다"는 뜻. 내 것이 아닌 이체도 같은 404 로 감춘다(IDOR 방지).
    @GetMapping("/transfers/{id}")
    @Transactional(readOnly = true)
    fun byId(@PathVariable id: String, @AuthenticationPrincipal userId: Long): TransferResponse {
        val publicId = runCatching { UUID.fromString(id) }.getOrNull()
        val transfer = publicId?.let(transferRepository::findByPublicId)
            ?.takeIf { it.from?.id == userId || it.to.id == userId }
            ?: throw DomainFailureException(FailureCode.TRANSFER_NOT_FOUND, "없음")
        return transfer.toResponse(userId, userRepository.sharedNames(), pointTypeRepository.sharedNames())
    }

    @GetMapping("/transfers")
    @Transactional(readOnly = true)
    fun history(
        @RequestParam(required = false) pointTypeId: String?,
        @RequestParam(defaultValue = "30") limit: Int,
        @AuthenticationPrincipal userId: Long,
    ): List<TransferResponse> {
        val resolvedPointTypeId = pointTypeId?.let { raw ->
            val id = runCatching { UUID.fromString(raw) }.getOrNull()?.let(pointTypeRepository::findByPublicId)
                ?: return emptyList()
            id.id
        }
        return transferRepository.history(userId, resolvedPointTypeId, Limit.of(limit))
            .map { it.toResponse(userId, userRepository.sharedNames(), pointTypeRepository.sharedNames()) }
    }

    private fun commit(
        idempotencyKey: String?,
        body: TransferRequest,
        userId: Long,
    ): ResponseEntity<TransferResponse> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "Idempotency-Key 없음")

        // 이미 있으면 새로 만들지 않는다. 다만 이 조회는 최적화일 뿐 방어가 아니다 —
        // 동시에 온 둘은 여기서 둘 다 없다고 본다. 진짜 방어는 아래 unique 위반 처리다.
        transferService.findByIdempotencyKey(key, userId)?.let { return ResponseEntity.ok(it) }

        val amount = body.amount?.let { raw ->
            // scale > 0 이면 소수점이 실려 온 것이다. stripTrailingZeros 로 100.0 은 통과시킨다.
            raw.stripTrailingZeros().takeIf { it.scale() <= 0 }?.runCatching { longValueExact() }?.getOrNull()
        }
        val wrong = when {
            body.pointTypeId.isNullOrBlank() -> "pointTypeId"
            body.toId.isNullOrBlank() -> "toId"
            amount == null || amount <= 0 || amount > MAX_SAFE_INTEGER -> "amount"
            else -> null
        }
        if (wrong != null) throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "$wrong 이(가) 계약과 다름")

        val transfer = try {
            transferService.commitTransfer(userId, key, body.pointTypeId!!, body.toId!!, amount!!)
        } catch (e: DataIntegrityViolationException) {
            // 같은 키가 동시에 왔다. 키의 unique 위반은 오류가 아니라 "이미 만들었다"는 뜻이다 —
            // 사용자는 응답을 못 받아 다시 누른 것뿐이고, 두 번 빠지면 되돌릴 경로가 없다.
            val existing = transferService.findByIdempotencyKey(key, userId) ?: throw e
            return ResponseEntity.ok(existing)
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(transfer)
    }
}

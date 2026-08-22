package io.github.miinhho.point.shop

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.JsonNode

@RestController
@RequestMapping("/api")
class ListingController(private val listingService: ListingService) {
    @GetMapping("/point-types/{pointTypeId}/listings")
    fun ofPointType(
        @PathVariable pointTypeId: String,
        @AuthenticationPrincipal userId: Long,
    ): List<ListingResponse> = listingService.ofPointType(pointTypeId, userId)

    @GetMapping("/listings/{id}")
    fun one(@PathVariable id: String, @AuthenticationPrincipal userId: Long): ListingResponse =
        listingService.one(id, userId)

    /**
     * 게시. 재고 없이 게시할 수 없다 — `stock` 과 `perPersonLimit` 은 **키가 있어야 하고**
     * 값은 양의 정수이거나 `null` 이다. 무제한은 기본값이 아니라 고르는 것이다.
     */
    @PostMapping("/point-types/{pointTypeId}/listings")
    fun create(
        @PathVariable pointTypeId: String,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: JsonNode,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<ListingResponse> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "Idempotency-Key 없음")
        // 조회가 방어는 아니다 — 동시에 온 둘은 여기서 둘 다 없다고 본다. 방어는 아래 unique 위반이다.
        listingService.findByIdempotencyKey(pointTypeId, userId, key)?.let { return ResponseEntity.ok(it) }

        val name = body.requiredText("name", min = 1, max = 20)
        val description = body.optionalText("description", max = 60)
        val price = body.requiredAmount("price")
        val stock = body.requiredCount("stock")
        val perPersonLimit = body.requiredCount("perPersonLimit")

        val listing = try {
            listingService.create(pointTypeId, userId, key, name, description, price, stock, perPersonLimit)
        } catch (e: DataIntegrityViolationException) {
            val existing = listingService.findByIdempotencyKey(pointTypeId, userId, key) ?: throw e
            return ResponseEntity.ok(existing)
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(listing)
    }

    /** 재고·1 인 한도·소개만. 값과 이름은 바꾸지 않는다 — 산 사람의 교환권이 가리키는 것이 바뀐다. */
    @PatchMapping("/listings/{id}")
    fun edit(
        @PathVariable id: String,
        @RequestBody body: JsonNode,
        @AuthenticationPrincipal userId: Long,
    ): ListingResponse = listingService.edit(
        listingPublicId = id,
        issuerId = userId,
        stock = body.changedCount("stock"),
        perPersonLimit = body.changedCount("perPersonLimit"),
        description = body.changedText("description", max = 60),
    )

    /** 팔린 뒤에도 된다 — 교환권은 남는다. 이미 내린 것을 다시 내려도 `204` 다. */
    @DeleteMapping("/listings/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unlist(@PathVariable id: String, @AuthenticationPrincipal userId: Long) =
        listingService.unlist(id, userId)
}

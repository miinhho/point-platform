package io.github.miinhho.point.pointtype

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserResponse
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 삭제 엔드포인트를 만들지 않는다 — 누군가 한 번이라도 받은 포인트를 지우는 것은
// 남의 지갑을 지우는 일이다 (docs/JOURNEY.md 여정 9).
@RestController
@RequestMapping("/api")
class PointTypeController(
    private val pointTypeQueryService: PointTypeQueryService,
    private val pointTypeCreateService: PointTypeCreateService,
    private val capChangeService: CapChangeService,
) {
    @GetMapping("/point-types")
    fun pointTypes(@AuthenticationPrincipal userId: Long): List<PointTypeResponse> =
        pointTypeQueryService.all(userId)

    // 회원 목록은 회원만 본다. 공개 은행에는 회원이라는 개념 자체가 없다.
    @GetMapping("/point-types/{id}/members")
    fun members(
        @PathVariable id: String,
        @AuthenticationPrincipal userId: Long,
    ): List<UserResponse> = pointTypeQueryService.members(id, userId)

    // 은행 페이지. 포인트 하나에 페이지 하나이고 보는 사람에 따라 내용이 늘 뿐이다
    // (docs/JOURNEY.md 「은행 페이지」).
    @GetMapping("/point-types/{id}")
    fun pointType(
        @PathVariable id: String,
        @AuthenticationPrincipal userId: Long,
    ): PointTypeResponse = pointTypeQueryService.one(id, userId)

    @PostMapping("/point-types")
    fun createPointType(
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: CreatePointTypeRequest,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<PointTypeResponse> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "Idempotency-Key 없음")

        // 이 조회는 최적화일 뿐 방어가 아니다. 동시에 온 둘은 여기서 둘 다 없다고 본다.
        pointTypeCreateService.findByIdempotencyKey(key, userId)?.let { return ResponseEntity.ok(it) }

        return try {
            ResponseEntity.status(HttpStatus.CREATED).body(pointTypeCreateService.create(userId, key, body))
        } catch (e: DataIntegrityViolationException) {
            // 남은 unique 는 (발행자, 키)뿐이다 — 같은 사람이 다시 누른 것이다.
            ResponseEntity.ok(pointTypeCreateService.findByIdempotencyKey(key, userId) ?: throw e)
        }
    }

    // 소개는 약속이 아니라 발행자가 적는 글이다 — 이력에 남지 않으므로 멱등성 키도 없다.
    @PatchMapping("/point-types/{id}")
    fun changeDescription(
        @PathVariable id: String,
        @RequestBody body: ChangeDescriptionRequest,
        @AuthenticationPrincipal userId: Long,
    ): PointTypeResponse = pointTypeCreateService.changeDescription(userId, id, body.description)

    // 취소 엔드포인트는 없다. 낮추는 것은 다시 PATCH 지만 취소가 아니다 —
    // 올려 둔 동안 발행된 것은 이미 남의 지갑에 있다.
    @PatchMapping("/point-types/{id}/cap")
    fun changeCap(
        @PathVariable id: String,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: ChangeCapRequest,
        @AuthenticationPrincipal userId: Long,
    ): PointTypeResponse {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "Idempotency-Key 없음")

        capChangeService.findByIdempotencyKey(key, userId)?.let { return it }
        return try {
            capChangeService.changeCap(userId, id, key, body.issueCap)
        } catch (e: DataIntegrityViolationException) {
            // 같은 키가 동시에 왔다 — 한 번만 바뀌고 둘 다 같은 결과를 본다.
            capChangeService.findByIdempotencyKey(key, userId) ?: throw e
        }
    }
}

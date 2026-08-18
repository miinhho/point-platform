package io.github.miinhho.point.wallet

import io.github.miinhho.point.api.DomainFailureException
import io.github.miinhho.point.api.UserResponse
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 삭제 엔드포인트를 만들지 않는다 — 누군가 한 번이라도 받은 포인트를 지우는 것은
// 남의 지갑을 지우는 일이다 (docs/JOURNEY.md 여정 9).
@RestController
@RequestMapping("/api")
class WalletController(
    private val walletService: WalletService,
    private val pointTypeCreateService: PointTypeCreateService,
) {
    @GetMapping("/me")
    fun me(@AuthenticationPrincipal userId: Long): UserResponse = walletService.me(userId)

    @GetMapping("/wallet")
    fun wallet(@AuthenticationPrincipal userId: Long): WalletResponse = walletService.wallet(userId)

    @GetMapping("/point-types")
    fun pointTypes(@AuthenticationPrincipal userId: Long): List<PointTypeResponse> = walletService.pointTypes(userId)

    @PostMapping("/point-types")
    fun createPointType(
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: CreatePointTypeRequest,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<PointTypeResponse> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException("SERVER", HttpStatus.BAD_REQUEST, "Idempotency-Key 없음")

        // 이 조회는 최적화일 뿐 방어가 아니다. 동시에 온 둘은 여기서 둘 다 없다고 본다.
        pointTypeCreateService.findByIdempotencyKey(key, userId)?.let { return ResponseEntity.ok(it) }

        return try {
            ResponseEntity.status(HttpStatus.CREATED).body(pointTypeCreateService.create(userId, key, body))
        } catch (e: DataIntegrityViolationException) {
            // 어느 제약이 깨졌는지는 키로 갈린다. 키가 이미 있으면 같은 사람이 다시 누른 것이고,
            // 없으면 기호가 겹친 것이다 — 그때는 기존 것을 돌려주지 않는다.
            // 남이 만든 포인트를 내 것이라고 답하는 셈이 되기 때문이다.
            pointTypeCreateService.findByIdempotencyKey(key, userId)?.let { return ResponseEntity.ok(it) }
            throw DomainFailureException("SYMBOL_TAKEN", HttpStatus.CONFLICT, "이미 쓰이는 기호")
        }
    }
}

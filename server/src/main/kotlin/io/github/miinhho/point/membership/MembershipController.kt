package io.github.miinhho.point.membership

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import io.github.miinhho.point.pointtype.PointTypeResponse

@RestController
@RequestMapping("/api")
class MembershipController(private val membershipService: MembershipService) {
    // 거절도 취소도 없다. 은행장이 부를 수 있는 것은 초대뿐이다.
    @PostMapping("/point-types/{id}/invites")
    fun invite(
        @PathVariable id: String,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @RequestBody body: InviteRequest,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<InviteResponse> {
        val key = idempotencyKey?.takeIf { it.isNotBlank() }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "Idempotency-Key 없음")
        return try {
            ResponseEntity.status(HttpStatus.CREATED).body(membershipService.invite(id, userId, body.userId, key))
        } catch (e: DataIntegrityViolationException) {
            // 트랜잭션 밖이라 여기서 다시 읽을 수 있다 — 서비스 안에서 잡으면 그 트랜잭션이
            // 이미 rollback-only 라 재조회가 못 산다.
            // 키가 먼저다. 같은 키로 대상만 바꿔 보낸 것이면 답은 그때 만든 초대다.
            val byKey = membershipService.findByIdempotencyKey(userId, key)
            // 키가 다르면 같은 사람에게 동시에 둘이 온 것이다 — 진 쪽도 같은 초대를 본다.
            ResponseEntity.ok(byKey ?: membershipService.invite(id, userId, body.userId, key))
        }
    }

    @GetMapping("/invites")
    fun received(@AuthenticationPrincipal userId: Long): List<InviteResponse> = membershipService.received(userId)

    // 초대가 아니라 은행을 가리킨다 — 초대 id 는 소진되면 새것이 난다.
    @PostMapping("/point-types/{id}/invites/accept")
    fun accept(@PathVariable id: String, @AuthenticationPrincipal userId: Long): PointTypeResponse =
        try {
            membershipService.accept(id, userId)
        } catch (e: DataIntegrityViolationException) {
            // 겹쳐 눌러 둘 다 회원이 아니라고 봤다. 진 쪽은 이제 회원이므로 다시 물으면 성공이다.
            membershipService.accept(id, userId)
        }

    @DeleteMapping("/point-types/{id}/members/me")
    fun leave(@PathVariable id: String, @AuthenticationPrincipal userId: Long): ResponseEntity<Unit> {
        membershipService.leave(id, userId)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/point-types/{id}/members/{userId}")
    fun remove(
        @PathVariable id: String,
        @PathVariable("userId") targetId: String,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<Unit> {
        membershipService.remove(id, userId, targetId)
        return ResponseEntity.noContent().build()
    }
}

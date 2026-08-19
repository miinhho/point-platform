package io.github.miinhho.point.pointtype

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
            // 같은 사람에게 동시에 둘이 오면 하나만 남는다 — 진 쪽도 같은 초대를 본다.
            ResponseEntity.ok(membershipService.invite(id, userId, body.userId, key))
        }
    }

    @GetMapping("/invites")
    fun received(@AuthenticationPrincipal userId: Long): List<InviteResponse> = membershipService.received(userId)

    @PostMapping("/invites/{id}/accept")
    fun accept(@PathVariable id: String, @AuthenticationPrincipal userId: Long): PointTypeResponse =
        membershipService.accept(id, userId)

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

package io.github.miinhho.point.user

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class UserController(private val userQueryService: UserQueryService) {
    // pointTypeId 가 오면 받는 사람 목록이 그 은행으로 좁혀진다 (docs/API.md 「회원 자격」).
    @GetMapping("/users")
    fun search(
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) pointTypeId: String?,
        @AuthenticationPrincipal userId: Long,
    ): List<UserResponse> = userQueryService.search(q, pointTypeId, userId)

    @GetMapping("/recent")
    fun recent(
        @RequestParam(required = false) pointTypeId: String?,
        @RequestParam(defaultValue = "4") limit: Int,
        @AuthenticationPrincipal userId: Long,
    ): List<UserResponse> {
        if (pointTypeId.isNullOrBlank()) {
            throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "pointTypeId 없음")
        }
        return userQueryService.recent(pointTypeId, limit, userId)
    }
}

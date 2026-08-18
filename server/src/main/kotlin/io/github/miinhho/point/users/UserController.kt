package io.github.miinhho.point.users

import io.github.miinhho.point.api.DomainFailureException
import io.github.miinhho.point.api.FailureCode
import io.github.miinhho.point.api.UserResponse
import io.github.miinhho.point.api.toResponse
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class UserController(private val userQueryService: UserQueryService) {
    @GetMapping("/users")
    fun search(
        @RequestParam(required = false) q: String?,
        @AuthenticationPrincipal userId: Long,
    ): List<UserResponse> = userQueryService.search(q, userId)

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

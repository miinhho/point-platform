package io.github.miinhho.point.shop

import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class VoucherController(private val voucherService: VoucherService) {
    /** 요청자의 행을 좁히는 조회라 필터로 감춘 것이 새지 않는다 — 없는 은행 id 는 `[]` 다. */
    @GetMapping("/vouchers")
    fun mine(
        @RequestParam(required = false) pointTypeId: String?,
        @AuthenticationPrincipal userId: Long,
    ): List<VoucherResponse> = voucherService.mine(userId, pointTypeId)

    @GetMapping("/vouchers/{id}")
    fun one(@PathVariable id: String, @AuthenticationPrincipal userId: Long): VoucherResponse =
        voucherService.one(id, userId)

    /** 커피를 건넸다는 표시. 은행장만 하고, 두 번째는 그때의 값을 그대로 돌려준다. */
    @PostMapping("/vouchers/{id}/redeem")
    fun redeem(@PathVariable id: String, @AuthenticationPrincipal userId: Long): VoucherResponse =
        voucherService.redeem(id, userId)
}

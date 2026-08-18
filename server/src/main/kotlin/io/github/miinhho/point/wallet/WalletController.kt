package io.github.miinhho.point.wallet

import io.github.miinhho.point.api.UserResponse
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class WalletController(private val walletService: WalletService) {
    @GetMapping("/me")
    fun me(@AuthenticationPrincipal userId: Long): UserResponse = walletService.me(userId)

    @GetMapping("/wallet")
    fun wallet(@AuthenticationPrincipal userId: Long): WalletResponse = walletService.wallet(userId)

    @GetMapping("/point-types")
    fun pointTypes(@AuthenticationPrincipal userId: Long): List<PointTypeResponse> = walletService.pointTypes(userId)
}

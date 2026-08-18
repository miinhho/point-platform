package io.github.miinhho.point.wallet

import io.github.miinhho.point.pointtype.PointTypeResponse
import io.github.miinhho.point.user.UserResponse

data class BalanceResponse(
    val pointType: PointTypeResponse,
    val amount: Long,
    val sendable: Long,
)
data class WalletResponse(val user: UserResponse, val balances: List<BalanceResponse>)

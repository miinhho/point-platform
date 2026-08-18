package io.github.miinhho.point.wallet

import io.github.miinhho.point.pointtype.PointTypeResponse
import io.github.miinhho.point.user.UserResponse

data class BalanceResponse(
    val pointType: PointTypeResponse,
    val amount: Long,
    val sendable: Long,
    /** 처음 받은 뒤 확인했는가. 발행자는 항상 참이다 — 자기가 만든 것을 확인할 것이 없다. */
    val acknowledged: Boolean,
)
data class WalletResponse(val user: UserResponse, val balances: List<BalanceResponse>)

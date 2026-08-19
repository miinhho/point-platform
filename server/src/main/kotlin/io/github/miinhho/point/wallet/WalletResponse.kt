package io.github.miinhho.point.wallet

import io.github.miinhho.point.pointtype.PointTypeResponse
import io.github.miinhho.point.user.UserResponse

data class BalanceResponse(
    val pointType: PointTypeResponse,
    val amount: Long,
    /** 이 포인트로 아직 보낸 적이 없다. 기기마다 달라지면 안 되므로 서버가 판정한다. */
    val neverSpent: Boolean,
    /** 지금 보낼 수 있는 양. 비공개 은행에서 나온 사람은 amount 가 남아도 0 이다. */
    val sendable: Long,
)
data class WalletResponse(val user: UserResponse, val balances: List<BalanceResponse>)

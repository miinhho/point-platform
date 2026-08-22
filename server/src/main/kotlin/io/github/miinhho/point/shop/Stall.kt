package io.github.miinhho.point.shop

/**
 * 한 사람 앞의 품목 하나. **판정 순서가 여기 한 번만 적혀 있다** — 순서에 없는 검사는
 * 구현할 때 빠지고, 두 곳에 적으면 화면이 말한 것과 쓰기가 하는 것이 갈린다
 * (docs/API.md 「상점」).
 *
 * 판 수는 세어서 온다. 접어 둔 칸을 받지 않는다 — 그 칸은 틀렸는지 알 방법이 없는데
 * 재고 판정이 그 위에 선다.
 */
class Stall(
    val price: Long,
    val stock: Int?,
    val perPersonLimit: Int?,
    val unlisted: Boolean,
    /** 그 품목의 교환권 수. 접어 둔 칸이 아니라 세어서 온 값이다. */
    val sold: Int,
    val soldToMe: Int,
) {
    /** 남은 개수. 무제한이면 null. 0 이면 0 이라고 말한다 — 숨기지 않는다. */
    val remaining: Int? = stock?.let { (it - sold).coerceAtLeast(0) }

    /** 한도 기준으로 이 사람이 앞으로 더 살 수 있는 개수. 한도가 없으면 null. */
    val myRemainingLimit: Int? = perPersonLimit?.let { (it - soldToMe).coerceAtLeast(0) }

    /**
     * 화면이 보는 값. 잔액까지 본다 — 한 개 값도 안 되면 못 산다.
     *
     * 회원 여부는 부르는 쪽이 준다. 공개 은행에는 회원이 없으므로 언제나 참이다.
     */
    fun buyability(member: Boolean, issuer: Boolean, balance: Long): Buyability =
        blocks(quantity = 1, member = member, issuer = issuer)
            ?: if (balance < price) Buyability.INSUFFICIENT_BALANCE else Buyability.OK

    /**
     * 쓰기 경로. 걸리는 첫 이유를 준다 — 하나라도 걸리면 **아무것도 팔지 않는다.**
     * 셋을 사려는데 둘만 남았으면 둘을 팔지 않는다 (docs/JOURNEY.md 여정 13).
     *
     * 잔액은 여기서 보지 않는다. 계정을 잠근 원장만이 지금 잔액을 알고, 미리 보면 낡은
     * 값으로 판정한다 — 판정과 차감 사이로 다른 이체가 지나간다.
     */
    fun blocks(quantity: Int, member: Boolean, issuer: Boolean): Buyability? = when {
        unlisted -> Buyability.UNLISTED
        !member -> Buyability.NOT_MEMBER
        issuer -> Buyability.ISSUER
        remaining != null && remaining < quantity -> Buyability.SOLD_OUT
        myRemainingLimit != null && myRemainingLimit < quantity -> Buyability.LIMIT_REACHED
        else -> null
    }
}

package io.github.miinhho.point.ledger

/**
 * 그 포인트의 공급 — 지금까지 발행된 양과 상한. 발행이 되는지, 상한을 그 아래로 내릴 수
 * 있는지, 얼마가 남았는지를 **한 곳에서만** 판정한다.
 *
 * 세 물음이 흩어져 있으면 곧 하나가 다른 답을 한다. 이 파일에도 import 가 없다.
 */
class Supply(val issued: Long, val cap: Long) {
    /** 발행자에게만 뜻이 있는 값. 넘긴 적이 있어도 음수로 보이지 않는다. */
    val headroom: Long get() = if (cap > issued) cap - issued else 0

    fun allows(amount: Long): Boolean = issued + amount <= cap

    /** 그 아래로 내리면 유통량이 상한을 넘은 상태가 되어 상한이 뜻을 잃는다. */
    fun canLowerTo(newCap: Long): Boolean = newCap >= issued
}

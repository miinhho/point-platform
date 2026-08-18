package io.github.miinhho.point.domain.balance

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface BalanceRepository : JpaRepository<Balance, BalanceId> {
    fun findByUserId(userId: Long): List<Balance>

    // 읽고 빼서 쓰지 않는다 — 두 요청이 같은 값을 읽으면 나중 것이 앞의 차감을 덮는다.
    // 조건을 UPDATE 안에 넣고 영향 행 수로 판정한다. 0 이면 잔액이 모자랐다는 뜻이다.
    @Modifying(flushAutomatically = true)
    @Query(
        "update Balance b set b.amount = b.amount - :amount " +
            "where b.id.userId = :userId and b.id.pointTypeId = :pointTypeId and b.amount >= :amount",
    )
    fun debit(userId: Long, pointTypeId: Long, amount: Long): Int

    @Modifying(flushAutomatically = true)
    @Query(
        "update Balance b set b.amount = b.amount + :amount " +
            "where b.id.userId = :userId and b.id.pointTypeId = :pointTypeId",
    )
    fun credit(userId: Long, pointTypeId: Long, amount: Long): Int
}

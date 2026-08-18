package io.github.miinhho.point.wallet

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface BalanceRepository : JpaRepository<Balance, BalanceId> {
    fun findByUserId(userId: Long): List<Balance>

    // 행의 존재가 아니라 잔액으로 판정한다 — 실패한 이체도 잔액 0 행을 남기고,
    // 그 행을 가진 것으로 치면 한 번 거절당한 사람이 비공개 은행을 영영 보게 된다.
    @Query("select b.id.pointTypeId from Balance b where b.id.userId = :userId and b.amount > 0")
    fun pointTypeIdsHeldBy(userId: Long): Set<Long>

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

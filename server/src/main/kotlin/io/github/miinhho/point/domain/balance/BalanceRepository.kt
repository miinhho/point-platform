package io.github.miinhho.point.domain.balance

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query

interface BalanceRepository : JpaRepository<Balance, BalanceId> {
    fun findByUserId(userId: Long): List<Balance>

    // 이체·발행 커밋 중 잔액 행을 잠근다 — 동시 요청이 같은 잔액을 함께 읽어
    // 함께 깎지 않게 한다. 행 생성은 BalanceInitializer 가 따로 맡는다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Balance b where b.id.userId = :userId and b.id.pointTypeId = :pointTypeId")
    fun findForUpdate(userId: Long, pointTypeId: Long): Balance?
}

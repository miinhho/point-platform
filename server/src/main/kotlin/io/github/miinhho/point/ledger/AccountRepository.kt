package io.github.miinhho.point.ledger

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

/**
 * 잔액을 바꾸는 문장은 전부 여기 있고 [Ledger] 만 부른다. 읽고 판단하고 쓰는 세 문장을
 * 한 문장으로 줄인 것들이다 — 판단은 `where` 에 있고 결과는 영향 행 수다.
 *
 * `holder_key` 로 찾는다. (point_type_id, holder_key) 가 unique 라 점 조회가 되어 행 락만
 * 잡는다 — user_id 인덱스로 가면 넥스트키 락이 이웃 행의 삽입과 부딪힌다.
 */
interface AccountRepository : JpaRepository<Account, Long> {
    fun findByUserId(userId: Long): List<Account>

    /** 받은 적 있는 포인트. 행은 사건에서만 나므로 행의 존재가 곧 「받은 적 있다」다. */
    @Query("select a.pointTypeId from Account a where a.userId = :userId")
    fun pointTypeIdsHeldBy(userId: Long): Set<Long>

    /** 포인트별 발행량. 발행 계정 잔액의 부호를 뒤집은 것이다. */
    @Query("select a.pointTypeId, -a.balance from Account a where a.kind = io.github.miinhho.point.ledger.AccountKind.ISSUANCE and a.pointTypeId in :pointTypeIds")
    fun issuedOf(pointTypeIds: Collection<Long>): List<Array<Any>>

    /**
     * 공급을 잠근다. 값으로 읽는다 — 엔티티 잠금 조회는 1 차 캐시에 이미 있으면 락은 잡되
     * 낡은 값을 준다. 없으면 null 이고 그것은 불변식이 깨진 것이다.
     */
    @Query(
        value = "select balance from accounts where point_type_id = :pointTypeId and holder_key = 0 for update",
        nativeQuery = true,
    )
    fun lockIssuance(pointTypeId: Long): Long?

    /** 보유자 입금. 행이 없으면 만든다 — 보유자 계정은 받을 때 생긴다 (docs/LEDGER.md). */
    @Modifying(flushAutomatically = true)
    @Query(
        value = "insert into accounts (point_type_id, user_id, kind, balance) values (:pointTypeId, :userId, 'HOLDER', :amount) " +
            "as incoming on duplicate key update balance = accounts.balance + incoming.balance",
        nativeQuery = true,
    )
    fun creditHolder(pointTypeId: Long, userId: Long, amount: Long): Int

    /** 보유자 차감. 0 행이면 잔액이 모자랐다 — 행이 없는 것도 잔액 0 이라 같은 답이다. */
    @Modifying(flushAutomatically = true)
    @Query(
        value = "update accounts set balance = balance - :amount " +
            "where point_type_id = :pointTypeId and holder_key = :userId and balance >= :amount",
        nativeQuery = true,
    )
    fun debitHolder(pointTypeId: Long, userId: Long, amount: Long): Int

    /** 발행 계정 차감. 빚의 반대편이라 음수로 간다. [lockIssuance] 를 쥔 채 부른다. */
    @Modifying(flushAutomatically = true)
    @Query(
        value = "update accounts set balance = balance - :amount where point_type_id = :pointTypeId and holder_key = 0",
        nativeQuery = true,
    )
    fun debitIssuance(pointTypeId: Long, amount: Long): Int

    @Query(
        value = "select id from accounts where point_type_id = :pointTypeId and holder_key = :holderKey",
        nativeQuery = true,
    )
    fun idOf(pointTypeId: Long, holderKey: Long): Long?
}

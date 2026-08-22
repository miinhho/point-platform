package io.github.miinhho.point.shop

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant
import java.util.UUID

interface VoucherRepository : JpaRepository<Voucher, Long> {
    fun findByPublicId(publicId: UUID): Voucher?

    /**
     * 그 품목이 몇 개 나갔는가. **품목 행을 잠근 아래에서만 판정에 쓴다** — 그 트랜잭션이
     * READ COMMITTED 라 이 읽기는 방금 커밋된 것까지 본다 ([Shelf]).
     *
     * `for share` 로 잠그지 않는다. 범위 스캔이라 갭 락을 잡고, 그러면 **다른 품목을 사는
     * 트랜잭션이 그 갭에 넣지 못해** 서로 물린다 — 실측에서 교착으로 났다.
     */
    @Query("select count(v) from Voucher v where v.purchase.listingId = :listingId")
    fun soldOf(listingId: Long): Long

    /** 사건 표를 조인하지 않는다 — 산 사람은 구매가 들고 있다. */
    @Query("select count(v) from Voucher v where v.purchase.listingId = :listingId and v.purchase.buyerId = :buyerId")
    fun soldToOf(listingId: Long, buyerId: Long): Long

    /** 아직 안 쓴 것만 표시한다. 0 행이면 이미 쓴 것이고 그때의 값이 그대로 남는다. */
    @Modifying(flushAutomatically = true)
    @Query(value = "update vouchers set redeemed_at = :now where id = :id and redeemed_at is null", nativeQuery = true)
    fun redeemIfUnused(id: Long, now: Instant): Int

    /** 이미 쓴 것의 그때 값. 값으로 읽는다 — 엔티티는 이 트랜잭션이 먼저 읽어 둔 낡은 것이다. */
    @Query("select v.redeemedAt from Voucher v where v.id = :id")
    fun redeemedAtOf(id: Long): Instant?

    // 목록의 「남은 개수」는 표시라 잠그지 않는다. 품목마다 물으면 N+1 이라 한 번에 모은다.
    @Query("select p.listingId, count(v) from Voucher v join v.purchase p where p.listingId in :listingIds group by p.listingId")
    fun soldByListing(listingIds: Collection<Long>): List<Array<Any>>

    @Query(
        "select p.listingId, count(v) from Voucher v join v.purchase p " +
            "where p.listingId in :listingIds and p.buyerId = :buyerId group by p.listingId",
    )
    fun soldToByListing(listingIds: Collection<Long>, buyerId: Long): List<Array<Any>>

    @Query("select v from Voucher v where v.purchase.id in :purchaseIds order by v.id")
    fun ofPurchases(purchaseIds: Collection<Long>): List<Voucher>

    @Query(
        "select v from Voucher v where v.purchase.buyerId = :userId " +
            "and (:pointTypeId is null or v.purchase.journalEntry.pointTypeId = :pointTypeId) " +
            "order by v.purchase.journalEntry.occurredAt desc, v.id desc",
    )
    fun mine(userId: Long, pointTypeId: Long?): List<Voucher>
}

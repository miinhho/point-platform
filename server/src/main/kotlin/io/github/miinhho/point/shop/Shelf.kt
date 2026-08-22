package io.github.miinhho.point.shop

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.support.TransactionSynchronizationManager
import org.springframework.transaction.annotation.Transactional

/**
 * 품목 행을 잠그고 그 아래에서 [Stall] 을 만든다. **락 순서는 품목 행 → 원장 적용부**이고
 * 적용부가 품목 행을 기다리는 경로는 없다 (docs/API.md 「상점」).
 *
 * **부르는 트랜잭션은 READ COMMITTED 여야 한다.** MySQL 기본값인 REPEATABLE READ 에서는
 * 잠그기 전에 잡힌 스냅샷이 계속 쓰여, 잠근 뒤에 세는 판 수가 **앞사람이 방금 커밋한
 * 교환권을 못 본다** — 실측하면 평범한 읽기가 1, 같은 순간의 잠금 읽기가 2 다.
 * 그 잠금 읽기로 메우면 이번엔 범위 스캔의 갭 락이 다른 품목의 구매를 물어 교착이 난다.
 */
@Service
class Shelf(
    private val listingRepository: ListingRepository,
    private val voucherRepository: VoucherRepository,
) {
    /** 사는 사람 앞의 진열대. 1 인 한도를 보려면 그 사람이 몇 개 샀는지도 잠그고 읽어야 한다. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun lockFor(listing: Listing, buyerId: Long): Stall =
        lock(listing) { id -> voucherRepository.soldToOf(id, buyerId).toInt() }

    /** 은행장이 재고를 고치거나 내릴 때. 1 인 한도는 그의 일이 아니라 묻지 않는다. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun lockForOwner(listing: Listing): Stall = lock(listing) { 0 }

    private fun lock(listing: Listing, soldToMe: (Long) -> Int): Stall {
        // 주석으로 적으면 다음 사람이 모른다. 낡은 판 수로 조용히 파느니 여기서 선다.
        check(TransactionSynchronizationManager.getCurrentTransactionIsolationLevel() == READ_COMMITTED) {
            "품목을 잠그는 트랜잭션은 READ COMMITTED 여야 한다"
        }
        val id = listing.id!!
        // 행이 사라졌다 — 아직 아무도 안 산 품목은 내릴 때 행째 지워진다.
        val row = listingRepository.lockListing(id).firstOrNull()
            ?: throw DomainFailureException(FailureCode.LISTING_NOT_FOUND, "없음")
        return Stall(
            price = listing.price,
            stock = row[0] as Int?,
            perPersonLimit = row[1] as Int?,
            unlisted = row[2] != null,
            sold = voucherRepository.soldOf(id).toInt(),
            soldToMe = soldToMe(id),
        )
    }
}

private const val READ_COMMITTED: Int = java.sql.Connection.TRANSACTION_READ_COMMITTED

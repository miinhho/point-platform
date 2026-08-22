package io.github.miinhho.point.shop

import io.github.miinhho.point.ledger.Ledger
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.membership.BankAccess
import io.github.miinhho.point.pointtype.toMark
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Isolation
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class PurchaseService(
    private val listingRepository: ListingRepository,
    private val purchaseRepository: PurchaseRepository,
    private val voucherRepository: VoucherRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val bankAccess: BankAccess,
    private val userRepository: UserRepository,
    private val ledger: Ledger,
    private val shelf: Shelf,
) {
    /** 남의 것이면 null 이다 — 없을 때와 같다. 이체의 `by-key` 와 같은 규칙이다. */
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, requesterId: Long): PurchaseResultResponse? =
        purchaseRepository.findByRequesterAndKey(requesterId, key)?.let { render(it, requesterId) }

    /**
     * 산다. **검사 순서는 일곱이고 하나라도 걸리면 아무것도 팔지 않는다** — 멱등성 키 →
     * 품목 상태 → 회원 → 은행장 아님 → 재고 → 1 인 한도 → 잔액 (docs/API.md 「상점」).
     *
     * 앞 여섯은 [Stall] 이 한 순서로 답하고 잔액만 원장이 답한다 — 계정을 잠근 쪽만이
     * 지금 잔액을 안다. 셋을 사려는데 둘만 남았으면 둘을 팔지 않는다.
     *
     * READ COMMITTED 인 이유는 [Shelf] 에 있다 — 판 수를 세는 자리 때문이다.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    fun buy(listingPublicId: String, buyerId: Long, idempotencyKey: String, quantity: Int): PurchaseResultResponse {
        val listing = requireListing(listingPublicId)
        val pointType = requireReachable(listing.pointTypeId, buyerId)
        // 값을 알아야 셀 수 있는 본문 검사다. 규칙이 아니라 안전 범위라 잠그기 전에 본다.
        val amount = runCatching { Math.multiplyExact(listing.price, quantity.toLong()) }.getOrNull()
            ?.takeIf { it <= MAX_SAFE_INTEGER }
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "quantity 이(가) 계약과 다름")

        val stall = shelf.lockFor(listing, buyerId)
        stall.blocks(quantity, member = bankAccess.isMember(pointType, buyerId), issuer = pointType.issuer.id == buyerId)
            ?.let { throw refuse(it, stall) }

        val entry = ledger.purchase(
            requesterId = buyerId,
            idempotencyKey = idempotencyKey,
            pointTypeId = pointType.id!!,
            buyerId = buyerId,
            issuerId = pointType.issuer.id!!,
            amount = amount,
        )
        val purchase = purchaseRepository.saveAndFlush(
            Purchase(
                journalEntry = entry,
                listingId = listing.id!!,
                buyerId = buyerId,
                listingName = listing.name,
                quantity = quantity,
                amount = amount,
            ),
        )
        // 교환권은 한 장이 한 개다 — 「세 잔짜리 한 장」은 없다 (docs/JOURNEY.md 여정 13).
        val vouchers = voucherRepository.saveAllAndFlush((1..quantity).map { Voucher(purchase) })
        return result(purchase, vouchers, listing, pointType, buyerId)
    }

    private fun refuse(reason: Buyability, stall: Stall): DomainFailureException = when (reason) {
        // 내려간 것은 없는 것과 같은 답이다 — 갈리면 무엇이 있었는지가 샌다.
        Buyability.UNLISTED -> DomainFailureException(FailureCode.LISTING_NOT_FOUND, "없음")
        Buyability.NOT_MEMBER -> DomainFailureException(FailureCode.NOT_MEMBER, "회원이 아님")
        Buyability.ISSUER -> DomainFailureException(FailureCode.ISSUER_CANNOT_BUY, "은행장은 자기 품목을 살 수 없음")
        // 고친 값을 함께 준다 — 화면이 다시 물어보지 않고 수량을 고친다.
        Buyability.SOLD_OUT -> DomainFailureException(FailureCode.OUT_OF_STOCK, "재고 부족", remaining = stall.remaining)
        Buyability.LIMIT_REACHED ->
            DomainFailureException(FailureCode.PURCHASE_LIMIT_EXCEEDED, "1인 한도 초과", myRemainingLimit = stall.myRemainingLimit)
        // 잔액은 원장이 답한다. 여기까지 오면 순서가 어긋난 것이다.
        Buyability.INSUFFICIENT_BALANCE, Buyability.OK -> error("판정에 없는 이유: $reason")
    }

    private fun render(purchase: Purchase, viewerId: Long): PurchaseResultResponse {
        val listing = listingRepository.findById(purchase.listingId).orElseThrow()
        val pointType = pointTypeRepository.findById(purchase.journalEntry.pointTypeId).orElseThrow()
        val vouchers = voucherRepository.ofPurchases(listOf(purchase.id!!))
        return result(purchase, vouchers, listing, pointType, viewerId)
    }

    private fun result(
        purchase: Purchase,
        vouchers: List<Voucher>,
        listing: Listing,
        pointType: PointType,
        viewerId: Long,
    ): PurchaseResultResponse {
        val owner = userRepository.findById(purchase.buyerId).orElseThrow()
        return PurchaseResultResponse(
            purchase = purchase.toResponse(listing, pointType, pointTypeRepository.sharedNames(listOf(pointType.name)), viewerId),
            vouchers = vouchers.map { it.toResponse(listing, pointType, owner) },
        )
    }

    private fun requireListing(listingPublicId: String): Listing =
        runCatching { UUID.fromString(listingPublicId) }.getOrNull()
            ?.let(listingRepository::findByPublicId)
            ?: throw DomainFailureException(FailureCode.LISTING_NOT_FOUND, "없음")

    // 닿지 못하는 은행의 품목은 없는 품목과 같은 404 다.
    private fun requireReachable(pointTypeId: Long, viewerId: Long): PointType =
        pointTypeRepository.findById(pointTypeId)
            .filter { bankAccess.canReach(it, viewerId) }
            .orElseThrow { DomainFailureException(FailureCode.LISTING_NOT_FOUND, "없음") }
}

fun Purchase.toResponse(listing: Listing, pointType: PointType, sharedPointNames: Set<String>, viewerId: Long) =
    PurchaseResponse(
        id = journalEntry.publicId.toString(),
        listingId = listing.publicId.toString(),
        listingName = listingName,
        pointTypeId = pointType.publicId.toString(),
        point = pointType.toMark(sharedPointNames),
        quantity = quantity,
        amount = amount,
        outgoing = buyerId == viewerId,
        occurredAt = journalEntry.occurredAt,
    )

fun Voucher.toResponse(listing: Listing, pointType: PointType, owner: User) = VoucherResponse(
    id = publicId.toString(),
    purchaseId = purchase.journalEntry.publicId.toString(),
    listingId = listing.publicId.toString(),
    listingName = purchase.listingName,
    pointTypeId = pointType.publicId.toString(),
    ownerId = owner.publicId.toString(),
    issuedAt = purchase.journalEntry.occurredAt,
    redeemedAt = redeemedAt,
)

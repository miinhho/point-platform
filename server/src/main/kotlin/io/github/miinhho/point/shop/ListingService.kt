package io.github.miinhho.point.shop

import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.pointtype.membership.BankAccess
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Isolation
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class ListingService(
    private val listingRepository: ListingRepository,
    private val voucherRepository: VoucherRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val accountRepository: AccountRepository,
    private val bankAccess: BankAccess,
    private val shelf: Shelf,
) {
    /** 내린 품목은 은행장에게만 온다. 다 팔린 것은 누구에게나 온다 — 0 을 숨기지 않는다. */
    @Transactional(readOnly = true)
    fun ofPointType(pointTypePublicId: String, viewerId: Long): List<ListingResponse> {
        val pointType = requireShoppable(pointTypePublicId, viewerId)
        val listings = listingRepository.ofPointType(pointType.id!!)
            .filter { !it.unlisted || pointType.issuer.id == viewerId }
        return render(listings, pointType, viewerId)
    }

    @Transactional(readOnly = true)
    fun one(listingPublicId: String, viewerId: Long): ListingResponse {
        val listing = requireListing(listingPublicId)
        val pointType = requireShoppable(listing.pointTypeId, viewerId)
        // 내려간 것은 없는 것과 같은 답이다 — 은행장만 그것이 있었다는 것을 안다.
        if (listing.unlisted && pointType.issuer.id != viewerId) {
            throw DomainFailureException(FailureCode.LISTING_NOT_FOUND, "없음")
        }
        return render(listOf(listing), pointType, viewerId).first()
    }

    @Transactional(readOnly = true)
    fun findByIdempotencyKey(pointTypePublicId: String, issuerId: Long, key: String): ListingResponse? {
        val pointType = requireIssued(pointTypePublicId, issuerId)
        val listing = listingRepository.findByPointTypeIdAndIdempotencyKey(pointType.id!!, key) ?: return null
        return render(listOf(listing), pointType, issuerId).first()
    }

    @Transactional
    fun create(
        pointTypePublicId: String,
        issuerId: Long,
        idempotencyKey: String,
        name: String,
        description: String?,
        price: Long,
        stock: Int?,
        perPersonLimit: Int?,
    ): ListingResponse {
        val pointType = requireIssued(pointTypePublicId, issuerId)
        val listing = listingRepository.saveAndFlush(
            Listing(
                pointTypeId = pointType.id!!,
                name = name,
                price = price,
                stock = stock,
                perPersonLimit = perPersonLimit,
                description = description,
                idempotencyKey = idempotencyKey,
            ),
        )
        return render(listOf(listing), pointType, issuerId).first()
    }

    /**
     * 재고·1 인 한도·소개만 바꾼다. 값과 이름은 바꾸지 않는다 — 산 사람의 교환권이 가리키는
     * 것이 바뀐다.
     *
     * **판정하는 동안 품목 행을 잠근다.** 확인하는 사이 구매가 끼면 확인은 통과하고 판 수가
     * 재고를 넘는다. 상한 변경이 발행과 같은 행을 잠그는 것과 같은 이유다.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    fun edit(
        listingPublicId: String,
        issuerId: Long,
        stock: Change<Int?>,
        perPersonLimit: Change<Int?>,
        description: Change<String?>,
    ): ListingResponse {
        val listing = requireListing(listingPublicId)
        val pointType = requireIssued(listing.pointTypeId, issuerId)
        val locked = shelf.lockForOwner(listing)
        if (locked.unlisted) throw DomainFailureException(FailureCode.LISTING_UNLISTED, "내린 품목")

        // 빠진 키는 잠그고 읽은 지금 값이다 — 엔티티의 값을 쓰면 남이 방금 바꾼 것을 되돌린다.
        val newStock = stock.or(locked.stock)
        val newLimit = perPersonLimit.or(locked.perPersonLimit)
        val newDescription = description.or(listing.description)
        if (newStock != null && newStock < locked.sold) {
            throw DomainFailureException(FailureCode.STOCK_BELOW_SOLD, "이미 판 수보다 낮은 재고")
        }
        check(listingRepository.edit(listing.id!!, newStock, newLimit, newDescription) == 1) {
            "잠근 품목이 사라졌다: ${listing.id}"
        }
        // 엔티티를 다시 읽지 않는다 — 1 차 캐시가 방금 쓴 것을 모르는 낡은 인스턴스를 준다.
        val after = Stall(listing.price, newStock, newLimit, unlisted = false, locked.sold, soldToMe = 0)
        return listing.toResponse(pointType, after, newDescription, Buyability.ISSUER)
    }

    /**
     * 아직 아무도 안 샀으면 행이 사라지고, 팔린 뒤에는 내린 시각이 찍힌다. 둘 다 `204` 이고
     * 이미 내린 것을 다시 내려도 `204` 다.
     *
     * **여기도 품목 행을 잠그고 읽는다.** 잠그지 않으면 구매가 커밋하는 사이 스냅샷으로
     * 「아무도 안 샀다」를 읽고 **방금 교환권이 가리키는 행을 지운다.**
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    fun unlist(listingPublicId: String, issuerId: Long) {
        val listing = requireListing(listingPublicId)
        requireIssued(listing.pointTypeId, issuerId)
        val locked = shelf.lockForOwner(listing)
        if (locked.unlisted) return

        if (locked.sold == 0) listingRepository.remove(listing.id!!)
        else listingRepository.unlist(listing.id!!, Instant.now().truncatedTo(ChronoUnit.MICROS))
    }

    private fun render(listings: List<Listing>, pointType: PointType, viewerId: Long): List<ListingResponse> {
        if (listings.isEmpty()) return emptyList()
        val ids = listings.mapNotNull { it.id }
        val sold = counts(voucherRepository.soldByListing(ids))
        val mine = counts(voucherRepository.soldToByListing(ids, viewerId))
        val issuer = pointType.issuer.id == viewerId
        val member = bankAccess.isMember(pointType, viewerId)
        val balance = accountRepository.balanceOf(pointType.id!!, viewerId) ?: 0
        return listings.map { listing ->
            val stall = Stall(
                price = listing.price,
                stock = listing.stock,
                perPersonLimit = listing.perPersonLimit,
                unlisted = listing.unlisted,
                sold = sold[listing.id] ?: 0,
                soldToMe = mine[listing.id] ?: 0,
            )
            listing.toResponse(pointType, stall, listing.description, stall.buyability(member, issuer, balance))
        }
    }

    private fun counts(rows: List<Array<Any>>): Map<Long, Int> =
        rows.associate { it[0] as Long to (it[1] as Long).toInt() }

    /** 상점에 닿는 문은 명부와 같다 — 닿지 못하면 없는 것이고, 닿되 회원이 아니면 `403` 이다. */
    private fun requireShoppable(pointTypePublicId: String, viewerId: Long): PointType {
        val pointType = runCatching { UUID.fromString(pointTypePublicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?.takeIf { bankAccess.canReach(it, viewerId) }
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        return requireShoppable(pointType, viewerId)
    }

    private fun requireShoppable(pointTypeId: Long, viewerId: Long): PointType {
        val pointType = pointTypeRepository.findById(pointTypeId)
            .filter { bankAccess.canReach(it, viewerId) }
            .orElseThrow { DomainFailureException(FailureCode.LISTING_NOT_FOUND, "없음") }
        return requireShoppable(pointType, viewerId)
    }

    private fun requireShoppable(pointType: PointType, viewerId: Long): PointType {
        if (pointType.visibility == PointVisibility.PRIVATE && !bankAccess.isMember(pointType, viewerId)) {
            throw DomainFailureException(FailureCode.NOT_MEMBER, "회원이 아님")
        }
        return pointType
    }

    private fun requireIssued(pointTypePublicId: String, issuerId: Long): PointType {
        val pointType = runCatching { UUID.fromString(pointTypePublicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?.takeIf { bankAccess.canReach(it, issuerId) }
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        return requireIssuer(pointType, issuerId)
    }

    private fun requireIssued(pointTypeId: Long, issuerId: Long): PointType =
        requireIssuer(pointTypeRepository.findById(pointTypeId).orElseThrow(), issuerId)

    private fun requireIssuer(pointType: PointType, issuerId: Long): PointType {
        if (pointType.issuer.id != issuerId) throw DomainFailureException(FailureCode.NOT_ISSUER, "발행자가 아님")
        return pointType
    }

    private fun requireListing(listingPublicId: String): Listing =
        runCatching { UUID.fromString(listingPublicId) }.getOrNull()
            ?.let(listingRepository::findByPublicId)
            ?: throw DomainFailureException(FailureCode.LISTING_NOT_FOUND, "없음")
}

/** 소개를 따로 받는다 — 방금 고친 값은 엔티티가 아직 모른다. */
fun Listing.toResponse(pointType: PointType, stall: Stall, description: String?, buyability: Buyability) = ListingResponse(
    id = publicId.toString(),
    pointTypeId = pointType.publicId.toString(),
    name = name,
    description = description,
    price = price,
    stock = stall.stock,
    remaining = stall.remaining,
    perPersonLimit = stall.perPersonLimit,
    myRemainingLimit = stall.myRemainingLimit,
    buyability = buyability.wire,
    createdAt = createdAt,
    unlistedAt = unlistedAt,
)

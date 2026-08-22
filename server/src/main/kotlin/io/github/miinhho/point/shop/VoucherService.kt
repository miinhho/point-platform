package io.github.miinhho.point.shop

import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Isolation
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class VoucherService(
    private val voucherRepository: VoucherRepository,
    private val listingRepository: ListingRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
) {
    /** 내 교환권. 최신순. 요청자의 행을 좁히는 조회라 없는 은행 id 를 넣어도 `[]` 다. */
    @Transactional(readOnly = true)
    fun mine(userId: Long, pointTypePublicId: String?): List<VoucherResponse> {
        val filterId = pointTypePublicId?.let { raw ->
            runCatching { UUID.fromString(raw) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
                ?: return emptyList()
        }
        return render(voucherRepository.mine(userId, filterId))
    }

    /** 가진 사람과 그 은행의 은행장이 본다. 남의 것은 없는 것과 같은 `404` 다. */
    @Transactional(readOnly = true)
    fun one(voucherPublicId: String, viewerId: Long): VoucherResponse {
        val voucher = require(voucherPublicId)
        val pointType = pointTypeOf(voucher)
        if (voucher.purchase.buyerId != viewerId && pointType.issuer.id != viewerId) {
            throw DomainFailureException(FailureCode.VOUCHER_NOT_FOUND, "없음")
        }
        return render(listOf(voucher)).first()
    }

    /**
     * 썼다고 표시한다. **은행장만** 한다 — 커피를 건넸다는 뜻이고 앱 밖의 일을 적는 것이다.
     *
     * 두 번째는 그때의 값을 그대로 돌려준다. 덮으면 「커피를 건넨 때」가 거짓이 된다 —
     * 일어난 일은 일어난 때의 값을 갖는다.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    fun redeem(voucherPublicId: String, issuerId: Long): VoucherResponse {
        val voucher = require(voucherPublicId)
        val pointType = pointTypeOf(voucher)
        // 산 사람도 못 본 것과 같은 답을 준다 — 자기 교환권을 보기만 하는 사람에게
        // 「권한이 없다」와 「없다」가 갈리면 남의 교환권 id 로 존재를 물을 수 있다.
        if (pointType.issuer.id != issuerId) throw DomainFailureException(FailureCode.VOUCHER_NOT_FOUND, "없음")

        // datetime(6) 은 마이크로초다 — 나노초로 답하면 그 값은 DB 에 없던 시각이다.
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        val redeemedAt = if (voucherRepository.redeemIfUnused(voucher.id!!, now) == 1) now
        else voucherRepository.redeemedAtOf(voucher.id!!)
        return render(listOf(voucher), overrideRedeemedAt = redeemedAt).first()
    }

    private fun render(vouchers: List<Voucher>, overrideRedeemedAt: Instant? = null): List<VoucherResponse> {
        if (vouchers.isEmpty()) return emptyList()
        val listings = listingRepository.findAllById(vouchers.map { it.purchase.listingId }).associateBy { it.id }
        val points = pointTypeRepository.findAllById(vouchers.map { it.purchase.journalEntry.pointTypeId }).associateBy { it.id }
        val owners = userRepository.findAllById(vouchers.map { it.purchase.buyerId }).associateBy { it.id }
        return vouchers.mapNotNull { voucher ->
            val listing = listings[voucher.purchase.listingId] ?: return@mapNotNull null
            val point = points[voucher.purchase.journalEntry.pointTypeId] ?: return@mapNotNull null
            val owner = owners[voucher.purchase.buyerId] ?: return@mapNotNull null
            voucher.toResponse(listing, point, owner).let {
                if (overrideRedeemedAt == null) it else it.copy(redeemedAt = overrideRedeemedAt)
            }
        }
    }

    private fun pointTypeOf(voucher: Voucher): PointType =
        pointTypeRepository.findById(voucher.purchase.journalEntry.pointTypeId).orElseThrow()

    private fun require(voucherPublicId: String): Voucher =
        runCatching { UUID.fromString(voucherPublicId) }.getOrNull()
            ?.let(voucherRepository::findByPublicId)
            ?: throw DomainFailureException(FailureCode.VOUCHER_NOT_FOUND, "없음")
}

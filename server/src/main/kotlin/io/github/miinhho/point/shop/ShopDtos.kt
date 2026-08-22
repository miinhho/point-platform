package io.github.miinhho.point.shop

import io.github.miinhho.point.pointtype.PointMarkResponse
import java.time.Instant

data class ListingResponse(
    val id: String,
    val pointTypeId: String,
    val name: String,
    val description: String?,
    /** 한 개 값. 바꾸지 않는다 — 바꾸려면 새로 올린다. */
    val price: Long,
    val stock: Int?,
    val remaining: Int?,
    val perPersonLimit: Int?,
    val myRemainingLimit: Int?,
    val buyability: String,
    val createdAt: Instant,
    /** 내린 시각. 내린 품목은 은행장에게만 오고 살 수도 고칠 수도 없다. */
    val unlistedAt: Instant?,
)

/** 한 번의 구매. 수량은 화면의 편의이고 원장의 단위는 교환권 하나다. */
data class PurchaseResponse(
    val id: String,
    val listingId: String,
    /** 그때의 이름. 품목이 내려가도 줄은 남는다. */
    val listingName: String,
    val pointTypeId: String,
    val point: PointMarkResponse,
    val quantity: Int,
    val amount: Long,
    /** 보는 사람 기준 — 산 사람이면 참, 받은 은행장이면 거짓. */
    val outgoing: Boolean,
    val occurredAt: Instant,
)

data class VoucherResponse(
    val id: String,
    val purchaseId: String,
    val listingId: String,
    val listingName: String,
    val pointTypeId: String,
    val ownerId: String,
    val issuedAt: Instant,
    val redeemedAt: Instant?,
)

data class PurchaseResultResponse(val purchase: PurchaseResponse, val vouchers: List<VoucherResponse>)

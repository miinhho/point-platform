package io.github.miinhho.point

import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.shop.ListingResponse
import io.github.miinhho.point.shop.ListingService
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * 픽스처가 품목을 만드는 유일한 자리. **게시 서비스를 지난다** — 리포지토리로 바로 넣으면
 * 화면이 만들 수 없는 품목이 테스트에 남는다 ([BankFixture] 와 같은 이유).
 */
@Component
class ShopFixture(private val listingService: ListingService) {
    fun list(
        pointType: PointType,
        name: String = "아메리카노",
        price: Long = 3_000,
        stock: Int? = null,
        perPersonLimit: Int? = null,
    ): ListingResponse = listingService.create(
        pointTypePublicId = pointType.publicId.toString(),
        issuerId = pointType.issuer.id!!,
        idempotencyKey = UUID.randomUUID().toString(),
        name = name,
        description = null,
        price = price,
        stock = stock,
        perPersonLimit = perPersonLimit,
    )
}

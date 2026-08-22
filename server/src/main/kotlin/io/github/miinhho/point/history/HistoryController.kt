package io.github.miinhho.point.history

import io.github.miinhho.point.issue.IssueResponse
import io.github.miinhho.point.pointtype.PointMarkResponse
import io.github.miinhho.point.shop.PurchaseResponse
import io.github.miinhho.point.transfer.TransferResponse
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

// 둘은 서로 다른 모양이어야 한다 — 위계를 빌려 쓰면 둘이 한 종류로 읽힌다.
data class HistoryEntryResponse(
    val type: String,
    val point: PointMarkResponse,
    val transfer: TransferResponse? = null,
    val issue: IssueResponse? = null,
    val purchase: PurchaseResponse? = null,
)

@RestController
@RequestMapping("/api")
class HistoryController(private val historyService: HistoryService) {
    /**
     * 이체와 발행을 서버가 섞어서 시간순으로 준다.
     *
     * 상한 변경은 오지 않는다 — 유통량·상한은 발행자 화면의 것이고, 바뀐 것을 줄로 남기면
     * 내역이 발행자의 관리 기록으로 채워진다 (docs/JOURNEY.md 여정 10).
     */
    @GetMapping("/history")
    fun history(
        @RequestParam(required = false) pointTypeId: String?,
        @RequestParam(defaultValue = "30") limit: Int,
        @AuthenticationPrincipal userId: Long,
    ): List<HistoryEntryResponse> = historyService.history(userId, pointTypeId, limit)
}

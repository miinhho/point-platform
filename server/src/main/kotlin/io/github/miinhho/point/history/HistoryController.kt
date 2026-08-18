package io.github.miinhho.point.history

import io.github.miinhho.point.transfer.TransferResponse
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

// Transfer.kind 와 HistoryEntry.type 은 다른 것이다 — 앞엣것은 이체냐 발행이냐를,
// 뒤엣것은 내역 줄의 종류를 가른다.
data class CapChangeResponse(
    val id: String,
    val idempotencyKey: String,
    val pointTypeId: String,
    val byId: String,
    val previousCap: Long,
    val issueCap: Long,
    val changedAt: Instant,
)

data class HistoryEntryResponse(
    val type: String,
    val transfer: TransferResponse? = null,
    val capChange: CapChangeResponse? = null,
)

@RestController
@RequestMapping("/api")
class HistoryController(private val historyService: HistoryService) {
    /**
     * 이체와 상한 변경을 서버가 섞어서 시간순으로 준다.
     *
     * 두 목록을 클라이언트가 받아 합치면 각 목록의 limit 안에 든 것만 합쳐져
     * 경계에서 항목이 사라진다.
     */
    @GetMapping("/history")
    fun history(
        @RequestParam(required = false) pointTypeId: String?,
        @RequestParam(defaultValue = "30") limit: Int,
        @AuthenticationPrincipal userId: Long,
    ): List<HistoryEntryResponse> = historyService.history(userId, pointTypeId, limit)
}

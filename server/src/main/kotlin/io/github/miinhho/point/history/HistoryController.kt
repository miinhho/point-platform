package io.github.miinhho.point.history

import io.github.miinhho.point.issue.IssueResponse
import io.github.miinhho.point.transfer.TransferResponse
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class CapChangeResponse(
    val id: String,
    val idempotencyKey: String,
    val pointTypeId: String,
    val byId: String,
    val previousCap: Long,
    val issueCap: Long,
    val changedAt: Instant,
)

/**
 * 내역 줄에 붙는 포인트의 표기. 지갑과 모수가 달라 클라이언트가 지갑에서 찾으면 없는 줄이 생긴다 —
 * 받은 것을 전액 보내면 그 순간 지갑에서 빠지고 방금 만든 이체 줄만 내역에 남는다.
 */
data class HistoryPointResponse(
    val name: String,
    val emoji: String,
    val accent: String,
    val nameIsShared: Boolean,
    val issuerHandle: String,
)

// 셋은 서로 다른 모양이어야 한다 — 위계를 빌려 쓰면 셋이 한 종류로 읽힌다.
data class HistoryEntryResponse(
    val type: String,
    val point: HistoryPointResponse,
    val transfer: TransferResponse? = null,
    val issue: IssueResponse? = null,
    val capChange: CapChangeResponse? = null,
)

@RestController
@RequestMapping("/api")
class HistoryController(private val historyService: HistoryService) {
    /**
     * 이체 · 발행 · 상한 변경을 서버가 섞어서 시간순으로 준다.
     *
     * 세 목록을 클라이언트가 받아 합치면 각 목록의 limit 안에 든 것만 합쳐져
     * 경계에서 항목이 사라진다.
     */
    @GetMapping("/history")
    fun history(
        @RequestParam(required = false) pointTypeId: String?,
        @RequestParam(defaultValue = "30") limit: Int,
        @AuthenticationPrincipal userId: Long,
    ): List<HistoryEntryResponse> = historyService.history(userId, pointTypeId, limit)
}

package io.github.miinhho.point.history

import io.github.miinhho.point.domain.balance.BalanceRepository
import io.github.miinhho.point.domain.pointtype.CapChange
import io.github.miinhho.point.domain.pointtype.CapChangeRepository
import io.github.miinhho.point.domain.pointtype.PointTypeRepository
import io.github.miinhho.point.domain.transfer.TransferRepository
import io.github.miinhho.point.transfer.toResponse
import org.springframework.data.domain.Limit
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class HistoryService(
    private val transferRepository: TransferRepository,
    private val capChangeRepository: CapChangeRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val balanceRepository: BalanceRepository,
) {
    @Transactional(readOnly = true)
    fun history(userId: Long, pointTypePublicId: String?, limit: Int): List<HistoryEntryResponse> {
        val filterId = pointTypePublicId?.let { raw ->
            runCatching { UUID.fromString(raw) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
                ?: return emptyList()
        }

        // 각 목록에서 limit 만큼 뽑아 합친 뒤 다시 limit 으로 자른다 — 어느 쪽이 몰려 있어도
        // 시간순 상위 limit 개가 정확히 나온다.
        val transfers = transferRepository.history(userId, filterId, Limit.of(limit))
            .map { HistoryEntryResponse(type = "transfer", transfer = it.toResponse()) to it.createdAt }

        val capChanges = visibleCapChanges(userId, filterId, limit)
            .map { HistoryEntryResponse(type = "capChange", capChange = it.toResponse()) to it.changedAt }

        return (transfers + capChanges)
            .sortedByDescending { (_, at) -> at }
            .take(limit)
            .map { (entry, _) -> entry }
    }

    // 그 포인트가 자기 지갑에 있는 사람과 발행자가 본다 — 발행자만 아는 변경은 약속이 아니다.
    private fun visibleCapChanges(userId: Long, filterId: Long?, limit: Int): List<CapChange> {
        val held = balanceRepository.findByUserId(userId).mapNotNull { it.pointType.id }
        val issued = pointTypeRepository.findAll().filter { it.issuer.id == userId }.mapNotNull { it.id }
        val visible = (held + issued).toSet()
        if (visible.isEmpty()) return emptyList()
        return capChangeRepository.visible(visible, filterId, Limit.of(limit))
    }
}

private fun CapChange.toResponse() = CapChangeResponse(
    id = publicId.toString(),
    idempotencyKey = idempotencyKey,
    pointTypeId = pointType.publicId.toString(),
    byId = by.publicId.toString(),
    previousCap = previousCap,
    issueCap = issueCap,
    changedAt = changedAt,
)


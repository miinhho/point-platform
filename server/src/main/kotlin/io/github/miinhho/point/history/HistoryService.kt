package io.github.miinhho.point.history

import io.github.miinhho.point.issue.IssueRepository
import io.github.miinhho.point.issue.toResponse
import io.github.miinhho.point.ledger.JournalEntry
import io.github.miinhho.point.ledger.JournalEntryRepository
import io.github.miinhho.point.ledger.JournalKind
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.toMark
import io.github.miinhho.point.shop.PurchaseRepository
import io.github.miinhho.point.shop.ListingRepository
import io.github.miinhho.point.shop.toResponse
import io.github.miinhho.point.transfer.TransferRepository
import io.github.miinhho.point.transfer.toResponse
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import org.springframework.data.domain.Limit
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class HistoryService(
    private val journalEntryRepository: JournalEntryRepository,
    private val transferRepository: TransferRepository,
    private val issueRepository: IssueRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val purchaseRepository: PurchaseRepository,
    private val listingRepository: ListingRepository,
) {
    /** 사건을 한 번에 뽑아 한 번에 자른다 — 부속 기록은 그 사건들의 id 로 한 번씩만 읽는다. */
    @Transactional(readOnly = true)
    fun history(userId: Long, pointTypePublicId: String?, limit: Int): List<HistoryEntryResponse> {
        val filterId = pointTypePublicId?.let { raw ->
            runCatching { UUID.fromString(raw) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
                ?: return emptyList()
        }
        val entries = journalEntryRepository.visibleTo(userId, filterId, Limit.of(limit))
        if (entries.isEmpty()) return emptyList()

        val ids = entries.mapNotNull { it.id }
        val transfers = transferRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }
        val issues = issueRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }
        val purchases = purchaseRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }
        val listings = listingRepository.findAllById(purchases.values.map { it.listingId }).associateBy { it.id }

        // 겹침도 사람도 포인트도 원장 전체에서 한 번씩만 모은다 — 줄마다 열면 N+1 이다.
        val people = userRepository.findAllById(entries.map { it.requesterId }).associateBy { it.id }
        val points = pointTypeRepository.findAllById(entries.map { it.pointTypeId }).associateBy { it.id }
        val counterparties = transfers.values.map { it.to }
        val sharedNames = userRepository.sharedNames(people.values.map { it.name } + counterparties.map { it.name })
        val sharedPointNames = pointTypeRepository.sharedNames(points.values.map { it.name })

        return entries.mapNotNull { entry ->
            val pointType = points[entry.pointTypeId] ?: return@mapNotNull null
            val requester = people[entry.requesterId] ?: return@mapNotNull null
            val mark = pointType.toMark(sharedPointNames)
            when (entry.kind) {
                JournalKind.TRANSFER -> transfers[entry.id]?.let {
                    HistoryEntryResponse("transfer", mark, transfer = it.toResponse(userId, requester, pointType, sharedNames, sharedPointNames))
                }
                JournalKind.ISSUE -> issues[entry.id]?.let {
                    HistoryEntryResponse("issue", mark, issue = it.toResponse(requester, pointType, sharedPointNames))
                }
                // 산 사람과 은행장 양쪽에 전기가 있어 둘 다 이 줄을 본다 — 방향은 outgoing 이 말한다.
                JournalKind.PURCHASE -> purchases[entry.id]?.let { purchase ->
                    listings[purchase.listingId]?.let { listing ->
                        HistoryEntryResponse(
                            "purchase",
                            mark,
                            purchase = purchase.toResponse(listing, pointType, sharedPointNames, userId),
                        )
                    }
                }
                // 상한 변경은 내역에 오르지 않는다 — 전기가 없어 여기까지 오지도 않는다.
                JournalKind.CAP_CHANGE -> null
            }
        }
    }
}

package io.github.miinhho.point.history

import io.github.miinhho.point.issue.IssueRepository
import io.github.miinhho.point.issue.toResponse
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.ledger.JournalEntry
import io.github.miinhho.point.ledger.JournalEntryRepository
import io.github.miinhho.point.ledger.JournalKind
import io.github.miinhho.point.pointtype.CapChange
import io.github.miinhho.point.pointtype.CapChangeRepository
import io.github.miinhho.point.membership.MembershipRepository
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.toMark
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
    private val capChangeRepository: CapChangeRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val accountRepository: AccountRepository,
    private val userRepository: UserRepository,
    private val membershipRepository: MembershipRepository,
) {
    /** 사건을 한 번에 뽑아 한 번에 자른다 — 부속 기록은 그 사건들의 id 로 한 번씩만 읽는다. */
    @Transactional(readOnly = true)
    fun history(userId: Long, pointTypePublicId: String?, limit: Int): List<HistoryEntryResponse> {
        val filterId = pointTypePublicId?.let { raw ->
            runCatching { UUID.fromString(raw) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
                ?: return emptyList()
        }
        val visible = visiblePointTypeIds(userId)
        if (visible.isEmpty()) return emptyList()

        val entries = journalEntryRepository.visibleTo(userId, visible, filterId, Limit.of(limit))
        if (entries.isEmpty()) return emptyList()

        val ids = entries.mapNotNull { it.id }
        val transfers = transferRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }
        val issues = issueRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }
        val capChanges = capChangeRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }

        // 겹침도 사람도 포인트도 원장 전체에서 한 번씩만 모은다 — 줄마다 열면 N+1 이다.
        val sharedNames = userRepository.sharedNames()
        val sharedPointNames = pointTypeRepository.sharedNames()
        val people = userRepository.findAllById(entries.map { it.requesterId }).associateBy { it.id }
        val points = pointTypeRepository.findAllById(entries.map { it.pointTypeId }).associateBy { it.id }

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
                JournalKind.CAP_CHANGE -> capChanges[entry.id]?.let {
                    HistoryEntryResponse("capChange", mark, capChange = it.toResponse(requester, pointType))
                }
            }
        }
    }

    /**
     * 지갑이 담는 것과 같은 기준이다 — 셋 다. 카드를 주기로 한 순간 그는 상한이라는 약속을
     * 보는 사람이 됐는데 약속이 바뀐 기록만 안 오면 「아직 아무 일도 없었구나」로 읽는다.
     */
    private fun visiblePointTypeIds(userId: Long): Set<Long> =
        accountRepository.pointTypeIdsHeldBy(userId) +
            pointTypeRepository.idsIssuedBy(userId) +
            membershipRepository.pointTypeIdsOf(userId)
}

private fun CapChange.toResponse(by: User, point: PointType) = CapChangeResponse(
    id = publicId.toString(),
    idempotencyKey = journalEntry.idempotencyKey,
    pointTypeId = point.publicId.toString(),
    byId = by.publicId.toString(),
    previousCap = previousCap,
    issueCap = issueCap,
    changedAt = journalEntry.occurredAt,
)

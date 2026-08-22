package io.github.miinhho.point.history

import io.github.miinhho.point.issue.IssueRepository
import io.github.miinhho.point.issue.toResponse
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.ledger.JournalEntry
import io.github.miinhho.point.ledger.JournalEntryRepository
import io.github.miinhho.point.ledger.JournalKind
import io.github.miinhho.point.pointtype.CapChange
import io.github.miinhho.point.pointtype.CapChangeRepository
import io.github.miinhho.point.pointtype.membership.MembershipRepository
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
        val entries = journalEntryRepository.visibleTo(userId, unusedMemberOf(userId), filterId, Limit.of(limit))
        if (entries.isEmpty()) return emptyList()

        val ids = entries.mapNotNull { it.id }
        val transfers = transferRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }
        val issues = issueRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }
        val capChanges = capChangeRepository.byJournalEntryIds(ids).associateBy { it.journalEntry.id }

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
                JournalKind.CAP_CHANGE -> capChanges[entry.id]?.let {
                    HistoryEntryResponse("capChange", mark, capChange = it.toResponse(requester, pointType))
                }
            }
        }
    }

    /**
     * 회원인데 아직 아무것도 못 받은 은행. 전기도 없고 내가 요청한 사건도 없으므로 이 목록이
     * 없으면 그 은행의 상한 변경이 안 보인다 — 「들어왔지만 아직 없는 0」인 회원의 자리다.
     *
     * 받은 적 있는 은행과 내가 만든 은행은 여기 없다. 그쪽은 전기와 요청자로 이미 잡힌다.
     * 빈 목록은 넘기지 않는다 — `in ()` 은 드라이버가 거절한다.
     */
    private fun unusedMemberOf(userId: Long): Collection<Long> {
        val unused = membershipRepository.pointTypeIdsOf(userId) - accountRepository.pointTypeIdsHeldBy(userId)
        return unused.ifEmpty { listOf(-1L) }
    }
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

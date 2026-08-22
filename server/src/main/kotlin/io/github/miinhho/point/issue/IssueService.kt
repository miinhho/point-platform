package io.github.miinhho.point.issue

import io.github.miinhho.point.ledger.Ledger
import io.github.miinhho.point.pointtype.membership.BankAccess
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** 발행은 이체가 아니다 — 대상이 없고, 잔액이 아니라 상한을 본다 (docs/API.md). */
@Service
class IssueService(
    private val issueRepository: IssueRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val ledger: Ledger,
    private val bankAccess: BankAccess,
) {
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, issuerId: Long): IssueResponse? =
        issueRepository.findByRequesterAndKey(issuerId, key)?.render()

    /** 남의 것은 없는 것과 같다 — id 는 내역에서 새어 나갈 수 있다. */
    @Transactional(readOnly = true)
    fun findById(publicId: String, viewerId: Long): IssueResponse {
        val issue = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(issueRepository::findByPublicId)
            ?.takeIf { it.journalEntry.requesterId == viewerId }
            ?: throw DomainFailureException(FailureCode.ISSUE_NOT_FOUND, "없음")
        return issue.render()
    }

    @Transactional
    fun commit(meId: Long, idempotencyKey: String, pointTypePublicId: String, amount: Long): IssueResponse {
        val pointType = runCatching { UUID.fromString(pointTypePublicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        // NOT_ISSUER 로 답하면 닿을 수 없는 비공개 은행이 없는 포인트(404)와 갈려 존재가 샌다.
        if (!bankAccess.canReach(pointType, meId)) {
            throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        }
        if (pointType.issuer.id != meId) throw DomainFailureException(FailureCode.NOT_ISSUER, "발행자가 아님")

        val issued = ledger.issue(meId, idempotencyKey, pointType.id!!, amount)
        return issueRepository.saveAndFlush(
            Issue(
                journalEntry = issued.entry,
                amount = amount,
                totalIssuedAfter = issued.totalIssuedAfter,
                issueCapAt = issued.issueCapAt,
            ),
        ).render()
    }

    // 사건이 id 로만 아는 것을 여기서 연다. 단건이라 한 번씩이면 된다.
    private fun Issue.render(): IssueResponse {
        val point = pointTypeRepository.findById(journalEntry.pointTypeId).orElseThrow()
        return toResponse(
            issuer = userRepository.findById(journalEntry.requesterId).orElseThrow(),
            point = point,
            sharedPointNames = pointTypeRepository.sharedNames(listOf(point.name)),
        )
    }
}

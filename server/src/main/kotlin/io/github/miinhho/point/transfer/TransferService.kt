package io.github.miinhho.point.transfer

import io.github.miinhho.point.ledger.Ledger
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.pointtype.membership.BankAccess
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import org.springframework.data.domain.Limit
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class TransferService(
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val transferRepository: TransferRepository,
    private val ledger: Ledger,
    private val bankAccess: BankAccess,
) {
    // 관여한 사람만 읽는다 — 남의 것은 없는 것과 같다 (docs/API.md).
    // open-in-view=false 라 지연 연관관계(pointType·from·to)는 트랜잭션 안에서 매핑까지 끝내야 한다.
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, requesterId: Long): TransferResponse? =
        transferRepository.findByRequesterAndKey(requesterId, key)?.render(requesterId)

    @Transactional
    fun commitTransfer(meId: Long, idempotencyKey: String, pointTypeId: String, toId: String, amount: Long): TransferResponse {
        val pointType = requirePointType(pointTypeId, meId)
        // sendable 이 0 이라고 답해 놓고 같은 이체를 성사시키면 그 사이로 돈이 실제로 움직인다.
        if (!bankAccess.isMember(pointType, meId)) {
            throw DomainFailureException(FailureCode.NOT_MEMBER, "회원이 아님")
        }
        val recipient = requireRecipient(toId)
        if (recipient.id == meId) throw malformed("자기 자신에게는 보낼 수 없음")
        // 비공개 은행에서 회원이 아닌 사람은 없는 사람과 구별되지 않아야 한다 — 새 코드를 두지 않는다.
        if (!bankAccess.isMember(pointType, recipient.id!!)) {
            throw DomainFailureException(FailureCode.RECIPIENT_NOT_FOUND, "대상 없음")
        }

        val entry = ledger.transfer(
            requesterId = meId,
            idempotencyKey = idempotencyKey,
            pointTypeId = pointType.id!!,
            fromId = meId,
            toId = recipient.id!!,
            amount = amount,
        )
        // saveAndFlush — 부속 기록이 커밋까지 미뤄지면 어느 문장이 깨졌는지 알 수 없다.
        return transferRepository.saveAndFlush(
            Transfer(
                journalEntry = entry,
                to = recipient,
                amount = amount,
            ),
        ).render(meId)
    }

    /** 관여한 사람만 읽는다 — 남의 것도 없는 것과 같은 404 다 (IDOR 방지). */
    @Transactional(readOnly = true)
    fun findById(publicId: String, viewerId: Long): TransferResponse {
        val transfer = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(transferRepository::findByPublicId)
            ?.takeIf { it.journalEntry.requesterId == viewerId || it.to.id == viewerId }
            ?: throw DomainFailureException(FailureCode.TRANSFER_NOT_FOUND, "없음")
        return transfer.render(viewerId)
    }

    @Transactional(readOnly = true)
    fun history(pointTypePublicId: String?, limit: Int, viewerId: Long): List<TransferResponse> {
        val filterId = pointTypePublicId?.let { raw ->
            runCatching { UUID.fromString(raw) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
                ?: return emptyList()
        }
        val transfers = transferRepository.history(viewerId, filterId, Limit.of(limit))
        if (transfers.isEmpty()) return emptyList()

        // 줄마다 열지 않는다 — 사건이 id 로만 아는 것을 한 번에 모은다.
        val sharedNames = userRepository.sharedNames()
        val sharedPointNames = pointTypeRepository.sharedNames()
        val people = userRepository.findAllById(transfers.map { it.journalEntry.requesterId }).associateBy { it.id }
        val points = pointTypeRepository.findAllById(transfers.map { it.journalEntry.pointTypeId }).associateBy { it.id }
        return transfers.mapNotNull { transfer ->
            val from = people[transfer.journalEntry.requesterId] ?: return@mapNotNull null
            val point = points[transfer.journalEntry.pointTypeId] ?: return@mapNotNull null
            transfer.toResponse(viewerId, from, point, sharedNames, sharedPointNames)
        }
    }

    private fun Transfer.render(viewerId: Long): TransferResponse = toResponse(
        viewerId = viewerId,
        from = userRepository.findById(journalEntry.requesterId).orElseThrow(),
        point = pointTypeRepository.findById(journalEntry.pointTypeId).orElseThrow(),
        sharedNames = userRepository.sharedNames(),
        sharedPointNames = pointTypeRepository.sharedNames(),
    )

    // 닿을 수 없는 은행은 없는 포인트와 같은 404 다 — 갈리는 순간 존재가 샌다.
    private fun requirePointType(pointTypeId: String, viewerId: Long): PointType {
        val id = runCatching { UUID.fromString(pointTypeId) }.getOrNull()
        return id?.let(pointTypeRepository::findByPublicId)?.takeIf { bankAccess.canReach(it, viewerId) }
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
    }

    private fun requireRecipient(userId: String): User {
        val id = runCatching { UUID.fromString(userId) }.getOrNull()
        return id?.let(userRepository::findByPublicId)
            ?: throw DomainFailureException(FailureCode.RECIPIENT_NOT_FOUND, "대상 없음")
    }

    private fun malformed(message: String) = DomainFailureException(FailureCode.MALFORMED_REQUEST, message)
}

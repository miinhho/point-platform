package io.github.miinhho.point.transfer

import io.github.miinhho.point.wallet.BalanceInitializer
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.wallet.Balance
import io.github.miinhho.point.wallet.BalanceRepository
import io.github.miinhho.point.pointtype.BankAccess
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.UnexpectedRollbackException
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class TransferService(
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val balanceRepository: BalanceRepository,
    private val transferRepository: TransferRepository,
    private val balanceInitializer: BalanceInitializer,
    private val bankAccess: BankAccess,
) {
    // 관여한 사람만 읽는다 — 남의 것은 없는 것과 같다 (docs/API.md).
    // open-in-view=false 라 지연 연관관계(pointType·from·to)는 트랜잭션 안에서 매핑까지 끝내야 한다.
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, requesterId: Long): TransferResponse? =
        transferRepository.findByRequesterIdAndIdempotencyKey(requesterId, key)?.toResponse()

    @Transactional
    fun commitTransfer(meId: Long, idempotencyKey: String, pointTypeId: String, toId: String, amount: Long): TransferResponse {
        val pointType = requirePointType(pointTypeId, meId)
        val recipient = requireRecipient(toId)
        if (recipient.id == meId) throw malformed("자기 자신에게는 보낼 수 없음")
        // 비공개 은행에서 회원이 아닌 사람은 없는 사람과 구별되지 않아야 한다 — 새 코드를 두지 않는다.
        if (!bankAccess.isMember(pointType, recipient.id!!)) {
            throw DomainFailureException(FailureCode.RECIPIENT_NOT_FOUND, "대상 없음")
        }

        val sender = userRepository.getReferenceById(meId)
        val recipientId = recipient.id!!
        val pointTypeId = pointType.id!!
        listOf(meId, recipientId).sorted().forEach { ensureBalanceRow(it, pointTypeId) }

        // 오름차순으로 건드린다 — 반대 방향 이체(A→B, B→A)가 겹칠 때 순서가 어긋나면 교착이다.
        // 차감이 실패하면 예외가 트랜잭션을 되돌리므로 먼저 더한 것도 함께 사라진다.
        if (meId < recipientId) {
            debitOrFail(meId, pointTypeId, amount)
            balanceRepository.credit(recipientId, pointTypeId, amount)
        } else {
            balanceRepository.credit(recipientId, pointTypeId, amount)
            debitOrFail(meId, pointTypeId, amount)
        }

        return record(TransferKind.TRANSFER, idempotencyKey, pointType, requester = sender, from = sender, to = recipient, amount = amount).toResponse()
    }

    // 근거: docs/JOURNEY.md 여정 7 — 무에서 만든다. 자기 지갑으로만 들어간다.
    @Transactional
    fun commitIssue(meId: Long, idempotencyKey: String, pointTypeId: String, amount: Long): TransferResponse {
        // 잠금 조회가 이 포인트의 첫 로드여야 한다 — 먼저 읽어 두면 캐시의 낡은 totalIssued 로 판정한다.
        val id = runCatching { UUID.fromString(pointTypeId) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")

        // 잔액 행 생성이 point_types 를 잠그기 전에 끝나야 한다 — 그 삽입은 FK 확인으로
        // 부모 행의 공유 락을 잡는데, 이 트랜잭션이 이미 배타 락을 쥐고 있으면 서로를 기다린다.
        ensureBalanceRow(meId, id)

        val pointType = pointTypeRepository.findForUpdate(id)!!
        // NOT_ISSUER 로 답하면 닿을 수 없는 비공개 은행이 없는 포인트(404)와 갈려 존재가 샌다.
        if (!bankAccess.canReach(pointType, meId)) {
            throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        }
        if (pointType.issuer.id != meId) throw DomainFailureException(FailureCode.NOT_ISSUER, "발행자가 아님")
        if (pointType.totalIssued + amount > pointType.issueCap) {
            throw DomainFailureException(FailureCode.CAP_EXCEEDED, "발행 상한 초과")
        }

        val issuer = userRepository.getReferenceById(meId)
        balanceRepository.credit(meId, id, amount)

        pointType.totalIssued += amount
        pointTypeRepository.save(pointType)

        return record(TransferKind.ISSUE, idempotencyKey, pointType, requester = issuer, from = null, to = issuer, amount = amount).toResponse()
    }

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

    // 영향 행 0 은 조건(balance >= amount)이 거짓이었다는 뜻이다.
    private fun debitOrFail(userId: Long, pointTypeId: Long, amount: Long) {
        if (balanceRepository.debit(userId, pointTypeId, amount) == 0) {
            throw DomainFailureException(FailureCode.INSUFFICIENT_BALANCE, "잔액 부족")
        }
    }

    // 중복키는 오류가 아니라 "다른 요청이 먼저 만들었다"는 뜻이다. 별도 트랜잭션이라
    // 그 롤백이 진행 중인 이체에 닿지 않는다.
    private fun ensureBalanceRow(userId: Long, pointTypeId: Long) {
        if (balanceInitializer.exists(userId, pointTypeId)) return
        try {
            balanceInitializer.create(userId, pointTypeId)
        } catch (_: DataIntegrityViolationException) {
        } catch (_: UnexpectedRollbackException) {
        }
    }

    // saveAndFlush 로 unique 위반을 여기서 터뜨린다 — 커밋 시점까지 미루면 어느 문장이 깨졌는지 알 수 없다.
    private fun record(
        kind: TransferKind,
        idempotencyKey: String,
        pointType: PointType,
        requester: User,
        from: User?,
        to: User,
        amount: Long,
    ): Transfer = transferRepository.saveAndFlush(
        Transfer(
            idempotencyKey = idempotencyKey,
            requester = requester,
            kind = kind,
            pointType = pointType,
            from = from,
            to = to,
            amount = amount,
        ),
    )
}

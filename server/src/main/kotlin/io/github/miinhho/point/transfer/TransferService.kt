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
        transferRepository.findByFromIdAndIdempotencyKey(requesterId, key)?.toResponse(requesterId, userRepository.sharedNames())

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

        return record(idempotencyKey, pointType, from = sender, to = recipient, amount = amount).toResponse(meId, userRepository.sharedNames())
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
        idempotencyKey: String,
        pointType: PointType,
        from: User,
        to: User,
        amount: Long,
    ): Transfer = transferRepository.saveAndFlush(
        Transfer(idempotencyKey = idempotencyKey, pointType = pointType, from = from, to = to, amount = amount),
    )
}

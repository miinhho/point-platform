package io.github.miinhho.point.transfer

import io.github.miinhho.point.api.DomainFailureException
import io.github.miinhho.point.domain.balance.Balance
import io.github.miinhho.point.domain.balance.BalanceRepository
import io.github.miinhho.point.domain.pointtype.PointType
import io.github.miinhho.point.domain.pointtype.PointTypeRepository
import io.github.miinhho.point.domain.transfer.Transfer
import io.github.miinhho.point.domain.transfer.TransferKind
import io.github.miinhho.point.domain.transfer.TransferRepository
import io.github.miinhho.point.domain.user.User
import io.github.miinhho.point.domain.user.UserRepository
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
) {
    // 관여한 사람만 읽는다 — 남의 것은 없는 것과 같다 (docs/API.md).
    // open-in-view=false 라 지연 연관관계(pointType·from·to)는 트랜잭션 안에서 매핑까지 끝내야 한다.
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, requesterId: Long): TransferResponse? =
        transferRepository.findByIdempotencyKey(key)
            ?.takeIf { it.from?.id == requesterId || it.to.id == requesterId }
            ?.toResponse()

    @Transactional
    fun commitTransfer(meId: Long, idempotencyKey: String, pointTypeId: String, toId: String, amount: Long): TransferResponse {
        val pointType = requirePointType(pointTypeId)
        val recipient = requireRecipient(toId)
        if (recipient.id == meId) throw malformed("자기 자신에게는 보낼 수 없음")

        val sender = userRepository.getReferenceById(meId)
        val balances = lockBalances(listOf(meId, recipient.id!!), pointType.id!!)
        val senderBalance = balances.getValue(meId)
        val recipientBalance = balances.getValue(recipient.id!!)

        if (senderBalance.amount < amount) {
            throw DomainFailureException("INSUFFICIENT_BALANCE", HttpStatus.UNPROCESSABLE_ENTITY, "잔액 부족")
        }
        senderBalance.amount -= amount
        recipientBalance.amount += amount
        balanceRepository.save(senderBalance)
        balanceRepository.save(recipientBalance)

        return record(TransferKind.TRANSFER, idempotencyKey, pointType, from = sender, to = recipient, amount = amount).toResponse()
    }

    // 근거: docs/JOURNEY.md 여정 7 — 무에서 만든다. 자기 지갑으로만 들어간다.
    @Transactional
    fun commitIssue(meId: Long, idempotencyKey: String, pointTypeId: String, amount: Long): TransferResponse {
        // 잠금 조회가 이 포인트의 첫 로드여야 한다 — 먼저 읽어 두면 캐시의 낡은 totalIssued 로 판정한다.
        val id = runCatching { UUID.fromString(pointTypeId) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
            ?: throw DomainFailureException("POINT_TYPE_NOT_FOUND", HttpStatus.NOT_FOUND, "포인트 없음")

        // 잔액 행 생성이 point_types 를 잠그기 전에 끝나야 한다 — 그 삽입은 FK 확인으로
        // 부모 행의 공유 락을 잡는데, 이 트랜잭션이 이미 배타 락을 쥐고 있으면 서로를 기다린다.
        ensureBalanceRow(meId, id)

        val pointType = pointTypeRepository.findForUpdate(id)!!
        if (pointType.issuer.id != meId) throw DomainFailureException("NOT_ISSUER", HttpStatus.FORBIDDEN, "발행자가 아님")
        if (pointType.totalIssued + amount > pointType.issueCap) {
            throw DomainFailureException("CAP_EXCEEDED", HttpStatus.UNPROCESSABLE_ENTITY, "발행 상한 초과")
        }

        val issuer = userRepository.getReferenceById(meId)
        val balance = balanceRepository.findForUpdate(meId, id)!!
        balance.amount += amount
        balanceRepository.save(balance)

        pointType.totalIssued += amount
        pointTypeRepository.save(pointType)

        return record(TransferKind.ISSUE, idempotencyKey, pointType, from = null, to = issuer, amount = amount).toResponse()
    }

    private fun requirePointType(pointTypeId: String): PointType {
        val id = runCatching { UUID.fromString(pointTypeId) }.getOrNull()
        return id?.let(pointTypeRepository::findByPublicId)
            ?: throw DomainFailureException("POINT_TYPE_NOT_FOUND", HttpStatus.NOT_FOUND, "포인트 없음")
    }

    private fun requireRecipient(userId: String): User {
        val id = runCatching { UUID.fromString(userId) }.getOrNull()
        return id?.let(userRepository::findByPublicId)
            ?: throw DomainFailureException("RECIPIENT_NOT_FOUND", HttpStatus.NOT_FOUND, "대상 없음")
    }

    private fun malformed(message: String) = DomainFailureException("SERVER", HttpStatus.BAD_REQUEST, message)

    /**
     * 만드는 것을 잠그는 것보다 먼저, 그리고 잠글 때는 내부 id 오름차순으로.
     *
     * 없는 행에 FOR UPDATE 를 걸면 갭 락이 잡히고, 그 갭에 넣으려는 별도 트랜잭션이
     * 이 트랜잭션을 기다리다 락 대기 타임아웃까지 간다. 순서가 어긋나면 반대 방향
     * 이체끼리 교착에 빠진다.
     */
    private fun lockBalances(userIds: List<Long>, pointTypeId: Long): Map<Long, Balance> {
        val ordered = userIds.distinct().sorted()
        ordered.forEach { ensureBalanceRow(it, pointTypeId) }
        return ordered.associateWith { balanceRepository.findForUpdate(it, pointTypeId)!! }
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
    private fun record(kind: TransferKind, idempotencyKey: String, pointType: PointType, from: User?, to: User, amount: Long): Transfer =
        transferRepository.saveAndFlush(
            Transfer(idempotencyKey = idempotencyKey, kind = kind, pointType = pointType, from = from, to = to, amount = amount),
        )
}

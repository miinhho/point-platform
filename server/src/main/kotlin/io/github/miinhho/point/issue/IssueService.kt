package io.github.miinhho.point.issue

import io.github.miinhho.point.pointtype.BankAccess
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.ledger.AccountInitializer
import io.github.miinhho.point.ledger.AccountRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.UnexpectedRollbackException
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** 발행은 이체가 아니다 — 대상이 없고, 잔액이 아니라 상한을 본다 (docs/API.md). */
@Service
class IssueService(
    private val issueRepository: IssueRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val accountRepository: AccountRepository,
    private val accountInitializer: AccountInitializer,
    private val bankAccess: BankAccess,
) {
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, issuerId: Long): IssueResponse? =
        issueRepository.findByIssuerIdAndIdempotencyKey(issuerId, key)?.toResponse(pointTypeRepository.sharedNames())

    /** 남의 것은 없는 것과 같다 — id 는 내역에서 새어 나갈 수 있다. */
    @Transactional(readOnly = true)
    fun findById(publicId: String, viewerId: Long): IssueResponse {
        val issue = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(issueRepository::findByPublicId)
            ?.takeIf { it.issuer.id == viewerId }
            ?: throw DomainFailureException(FailureCode.TRANSFER_NOT_FOUND, "없음")
        return issue.toResponse(pointTypeRepository.sharedNames())
    }

    @Transactional
    fun commit(meId: Long, idempotencyKey: String, pointTypePublicId: String, amount: Long): IssueResponse {
        // 잠금 조회가 이 포인트의 첫 로드여야 한다 — 먼저 읽어 두면 캐시의 낡은 totalIssued 로 판정한다.
        val id = runCatching { UUID.fromString(pointTypePublicId) }.getOrNull()
            ?.let(pointTypeRepository::findIdByPublicId)
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")

        // 잔액 행 생성이 point_types 를 잠그기 전에 끝나야 한다 — 그 삽입은 FK 확인으로
        // 부모 행의 공유 락을 잡는데, 이 트랜잭션이 이미 배타 락을 쥐고 있으면 서로를 기다린다.
        ensureAccount(meId, id)

        val pointType = pointTypeRepository.findForUpdate(id)!!
        // NOT_ISSUER 로 답하면 닿을 수 없는 비공개 은행이 없는 포인트(404)와 갈려 존재가 샌다.
        if (!bankAccess.canReach(pointType, meId)) {
            throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        }
        if (pointType.issuer.id != meId) throw DomainFailureException(FailureCode.NOT_ISSUER, "발행자가 아님")
        if (pointType.totalIssued + amount > pointType.issueCap) {
            throw DomainFailureException(FailureCode.CAP_EXCEEDED, "발행 상한 초과")
        }

        accountRepository.credit(meId, id, amount)
        pointType.totalIssued += amount
        pointTypeRepository.save(pointType)

        // 상한 검사와 같은 트랜잭션·같은 잠금 안에서 찍는다. 나중에 계산하면 그 사이 발행이 끼어 틀린다.
        return issueRepository.saveAndFlush(
            Issue(
                idempotencyKey = idempotencyKey,
                issuer = userRepository.getReferenceById(meId),
                pointType = pointType,
                amount = amount,
                totalIssuedAfter = pointType.totalIssued,
                issueCapAt = pointType.issueCap,
            ),
        ).toResponse(pointTypeRepository.sharedNames())
    }

    // 중복키는 오류가 아니라 "다른 요청이 먼저 만들었다"는 뜻이다. 별도 트랜잭션이라
    // 그 롤백이 진행 중인 발행에 닿지 않는다.
    private fun ensureAccount(userId: Long, pointTypeId: Long) {
        if (accountInitializer.exists(userId, pointTypeId)) return
        try {
            accountInitializer.create(userId, pointTypeId)
        } catch (_: DataIntegrityViolationException) {
        } catch (_: UnexpectedRollbackException) {
        }
    }
}

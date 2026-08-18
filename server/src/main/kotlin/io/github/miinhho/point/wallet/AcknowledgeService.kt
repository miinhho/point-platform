package io.github.miinhho.point.wallet

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.pointtype.PointTypeRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class AcknowledgeService(
    private val pointTypeRepository: PointTypeRepository,
    private val balanceRepository: BalanceRepository,
) {
    /** 갖고 있지 않으면 404. 이미 확인한 것에 다시 보내도 성공이다(멱등). */
    @Transactional
    fun acknowledge(userId: Long, publicId: String) {
        val pointTypeId = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(pointTypeRepository::findIdByPublicId)
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")

        val balance = balanceRepository.findById(BalanceId(userId, pointTypeId)).orElse(null)
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "갖고 있지 않음")
        balance.acknowledged = true
        balanceRepository.save(balance)
    }
}

package io.github.miinhho.point.pointtype

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class PointTypeQueryService(
    private val pointTypeRepository: PointTypeRepository,
    private val bankAccess: BankAccess,
    private val pointTypeResponses: PointTypeResponses,
) {
    @Transactional(readOnly = true)
    fun all(viewerId: Long): List<PointTypeResponse> {
        val reachable = bankAccess.reachablePrivateIds(viewerId)
        val visible = pointTypeRepository.findAll().filter { bankAccess.canReach(it, viewerId, reachable) }
        return pointTypeResponses.of(visible, viewerId)
    }

    /** 은행 페이지. 닿을 수 없는 비공개는 없는 것과 같다. */
    @Transactional(readOnly = true)
    fun one(publicId: String, viewerId: Long): PointTypeResponse {
        val pointType = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?.takeIf { bankAccess.canReach(it, viewerId) }
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        return pointTypeResponses.of(pointType, viewerId)
    }
}

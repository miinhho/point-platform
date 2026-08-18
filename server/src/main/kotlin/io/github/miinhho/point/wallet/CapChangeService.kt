package io.github.miinhho.point.wallet

import io.github.miinhho.point.api.DomainFailureException
import io.github.miinhho.point.api.FailureCode
import io.github.miinhho.point.domain.pointtype.CapChange
import io.github.miinhho.point.domain.pointtype.CapChangeRepository
import io.github.miinhho.point.domain.pointtype.PointTypeRepository
import io.github.miinhho.point.domain.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID

private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

@Service
class CapChangeService(
    private val pointTypeRepository: PointTypeRepository,
    private val capChangeRepository: CapChangeRepository,
    private val userRepository: UserRepository,
    private val capChangeLookup: CapChangeLookup,
) {
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, viewerId: Long): PointTypeResponse? =
        capChangeRepository.findByByIdAndIdempotencyKey(viewerId, key)
            ?.let { it.pointType.toResponse(viewerId, pointTypeRepository.sharedNames()) }

    /**
     * 상한을 바꾼다. 되돌릴 수 없고 이력에 남는다.
     *
     * 발행이 상한을 읽을 때와 **같은 행을 잠근다** — 「이미 발행한 양보다 낮출 수 없다」를
     * 확인하는 동안 발행이 끼어들면 확인은 통과하고 결과는 유통량이 상한을 넘은 상태가 된다.
     */
    @Transactional
    fun changeCap(actorId: Long, publicId: String, idempotencyKey: String, requested: BigDecimal?): PointTypeResponse {
        val newCap = requested?.asSafeInteger()
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "요청 형식 오류")
        if (newCap <= 0) throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "요청 형식 오류")

        val id = runCatching { UUID.fromString(publicId) }.getOrNull()?.let(pointTypeRepository::findIdByPublicId)
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        val pointType = pointTypeRepository.findForUpdate(id)!!

        // 멱등 재요청 판정이 검증보다 먼저다 — 경쟁에서 진 쪽은 이 시점에 상한이 이미
        // 바뀌어 있어, 순서가 뒤바뀌면 "지금과 같은 값" 으로 잘못 거절된다.
        capChangeLookup.freshFindByIdempotencyKey(actorId, idempotencyKey)?.let {
            return pointType.toResponse(actorId, pointTypeRepository.sharedNames())
        }

        if (pointType.issuer.id != actorId) {
            throw DomainFailureException(FailureCode.NOT_ISSUER, "발행자가 아님")
        }
        if (newCap < pointType.totalIssued) {
            // 그 아래로 내리면 유통량이 상한을 넘은 상태가 되어 상한이 뜻을 잃는다.
            throw DomainFailureException(FailureCode.CAP_BELOW_ISSUED, "이미 발행한 양보다 낮음")
        }
        if (newCap == pointType.issueCap) {
            // 이력에 남는 사건이므로 아무것도 바꾸지 않는 줄을 만들지 않는다.
            throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "지금과 같은 값")
        }

        val previousCap = pointType.issueCap
        pointType.issueCap = newCap
        pointTypeRepository.save(pointType)
        capChangeRepository.saveAndFlush(
            CapChange(
                idempotencyKey = idempotencyKey,
                pointType = pointType,
                by = userRepository.getReferenceById(actorId),
                previousCap = previousCap,
                issueCap = newCap,
            ),
        )
        return pointType.toResponse(actorId, pointTypeRepository.sharedNames())
    }

    private fun BigDecimal.asSafeInteger(): Long? =
        stripTrailingZeros().takeIf { it.scale() <= 0 }
            ?.runCatching { longValueExact() }?.getOrNull()
            ?.takeIf { it <= MAX_SAFE_INTEGER }
}

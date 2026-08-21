package io.github.miinhho.point.pointtype

import io.github.miinhho.point.ledger.Ledger
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID
import io.github.miinhho.point.membership.BankAccess

private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

@Service
class CapChangeService(
    private val pointTypeRepository: PointTypeRepository,
    private val capChangeRepository: CapChangeRepository,
    private val ledger: Ledger,
    private val pointTypeResponses: PointTypeResponses,
    private val bankAccess: BankAccess,
) {
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, viewerId: Long): PointTypeResponse? =
        capChangeRepository.findByRequesterAndKey(viewerId, key)
            ?.let { pointTypeRepository.findById(it.journalEntry.pointTypeId).orElse(null) }
            ?.let { pointTypeResponses.of(it, viewerId) }

    /**
     * 상한을 바꾼다. 되돌릴 수 없고 이력에 남는다.
     *
     * 발행이 여유를 볼 때와 **같은 행을 잠근다**(발행 계정) — 「이미 발행한 양보다 낮출 수
     * 없다」를 확인하는 동안 발행이 끼어들면 확인은 통과하고 결과는 유통량이 상한을 넘는다.
     */
    @Transactional
    fun changeCap(actorId: Long, publicId: String, idempotencyKey: String, requested: BigDecimal?): PointTypeResponse {
        val newCap = requested?.asSafeInteger()
            ?: throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "요청 형식 오류")
        if (newCap <= 0) throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "요청 형식 오류")

        val pointType = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            // 닿을 수 없는 은행에 NOT_ISSUER 로 답하면 없는 포인트(404)와 갈려 존재가 샌다.
            ?.takeIf { bankAccess.canReach(it, actorId) }
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        if (pointType.issuer.id != actorId) {
            throw DomainFailureException(FailureCode.NOT_ISSUER, "발행자가 아님")
        }

        // 사건 행이 첫 쓰기다 — 같은 키가 동시에 오면 여기서 갈리고 상한에 닿지 않는다.
        val capped = ledger.changeCap(actorId, idempotencyKey, pointType.id!!)
        if (!capped.supply.canLowerTo(newCap)) {
            throw DomainFailureException(FailureCode.CAP_BELOW_ISSUED, "이미 발행한 양보다 낮음")
        }
        // 잠근 뒤의 값이다 — 엔티티의 상한은 잠금 전에 로드돼 낡았을 수 있다.
        val previousCap = capped.supply.cap
        if (newCap == previousCap) {
            // 이력에 남는 사건이므로 아무것도 바꾸지 않는 줄을 만들지 않는다.
            throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "지금과 같은 값")
        }

        ledger.setCap(pointType.id!!, newCap)
        capChangeRepository.saveAndFlush(
            CapChange(
                journalEntry = capped.entry,
                previousCap = previousCap,
                issueCap = newCap,
            ),
        )
        return pointTypeResponses.of(pointType, actorId)
    }

    private fun BigDecimal.asSafeInteger(): Long? =
        stripTrailingZeros().takeIf { it.scale() <= 0 }
            ?.runCatching { longValueExact() }?.getOrNull()
            ?.takeIf { it <= MAX_SAFE_INTEGER }
}

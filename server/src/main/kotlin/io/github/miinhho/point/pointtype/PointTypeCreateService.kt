package io.github.miinhho.point.pointtype

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

// JS Number.MAX_SAFE_INTEGER — 프론트가 안전하게 다룰 수 있는 정수 상한. 근거: docs/API.md
private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L
private val SYMBOL = Regex("^[A-Za-z]{2,3}$")

@Service
class PointTypeCreateService(
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
) {
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, viewerId: Long): PointTypeResponse? =
        pointTypeRepository.findByIssuerIdAndIdempotencyKey(viewerId, key)?.toResponse(viewerId, pointTypeRepository.sharedNames())

    /** 발행자 자격을 심사하지 않는다 — 누구나 만들고 상한도 자기가 정한다 (docs/JOURNEY.md 여정 9). */
    @Transactional
    fun create(creatorId: Long, idempotencyKey: String, request: CreatePointTypeRequest): PointTypeResponse {
        val name = request.name?.trim().orEmpty()
        val symbol = request.symbol?.trim().orEmpty()
        val accent = request.accent?.trim()?.uppercase()
        val issueCap = request.issueCap?.asSafeInteger()
        val visibility = request.visibility?.trim()?.uppercase()
            ?.let { name -> PointVisibility.entries.find { it.name == name } }

        val malformed = name.filterNot(Char::isWhitespace).length !in 1..12 ||
            !SYMBOL.matches(symbol) ||
            accent == null || PointAccent.entries.none { it.name == accent } ||
            issueCap == null || issueCap <= 0 ||
            visibility == null
        if (malformed) throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "요청 형식 오류")

        // 조회는 방어가 아니다 — 같은 기호가 동시에 오면 둘 다 비어 있다고 본다.
        // 진짜 방어는 symbol unique 제약이고, 위반 판정은 호출부가 한다.
        val created = pointTypeRepository.saveAndFlush(
            PointType(
                name = name,
                symbol = symbol,
                issuer = userRepository.getReferenceById(creatorId),
                accent = PointAccent.valueOf(accent!!),
                visibility = visibility!!,
                issueCap = issueCap!!,
                totalIssued = 0,
                idempotencyKey = idempotencyKey,
            ),
        )
        return created.toResponse(creatorId, pointTypeRepository.sharedNames())
    }

    private fun BigDecimal.asSafeInteger(): Long? =
        stripTrailingZeros().takeIf { it.scale() <= 0 }
            ?.runCatching { longValueExact() }?.getOrNull()
            ?.takeIf { it <= MAX_SAFE_INTEGER }
}

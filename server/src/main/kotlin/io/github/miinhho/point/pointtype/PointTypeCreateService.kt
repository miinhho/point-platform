package io.github.miinhho.point.pointtype

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID

// JS Number.MAX_SAFE_INTEGER — 프론트가 안전하게 다룰 수 있는 정수 상한. 근거: docs/API.md
private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

@Service
class PointTypeCreateService(
    private val pointTypeRepository: PointTypeRepository,
    private val membershipRepository: MembershipRepository,
    private val userRepository: UserRepository,
    private val pointTypeResponses: PointTypeResponses,
    private val bankAccess: BankAccess,
) {
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, viewerId: Long): PointTypeResponse? =
        pointTypeRepository.findByIssuerIdAndIdempotencyKey(viewerId, key)?.let { pointTypeResponses.of(it, viewerId) }

    /** 발행자 자격을 심사하지 않는다 — 누구나 만들고 상한도 자기가 정한다 (docs/JOURNEY.md 여정 9). */
    @Transactional
    fun create(creatorId: Long, idempotencyKey: String, request: CreatePointTypeRequest): PointTypeResponse {
        val name = request.name?.trim().orEmpty()
        val emoji = request.emoji?.trim().orEmpty()
        val description = request.description?.trim()
        val accent = request.accent?.trim()?.uppercase()
        val issueCap = request.issueCap?.asSafeInteger()
        val visibility = request.visibility?.trim()?.uppercase()
            ?.let { name -> PointVisibility.entries.find { it.name == name } }

        val malformed = name.filterNot(Char::isWhitespace).length !in 1..12 ||
            // 허용 목록 대조가 유일하게 맞는 검사다(결합 이모지는 코드포인트가 여럿이다).
            // 목록이 아직 오지 않아 여기는 저장 한계만 본다.
            emoji.isEmpty() || emoji.length > 32 ||
            description != null && description.filterNot(Char::isWhitespace).length > 60 ||
            accent == null || PointAccent.entries.none { it.name == accent } ||
            issueCap == null || issueCap <= 0 ||
            visibility == null
        if (malformed) throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "요청 형식 오류")

        // 조회는 방어가 아니다 — 같은 기호가 동시에 오면 둘 다 비어 있다고 본다.
        // 진짜 방어는 symbol unique 제약이고, 위반 판정은 호출부가 한다.
        val issuer = userRepository.getReferenceById(creatorId)
        val created = pointTypeRepository.saveAndFlush(
            PointType(
                name = name,
                emoji = emoji,
                description = description?.takeIf { it.isNotEmpty() },
                issuer = issuer,
                accent = PointAccent.valueOf(accent!!),
                visibility = visibility!!,
                issueCap = issueCap!!,
                totalIssued = 0,
                idempotencyKey = idempotencyKey,
            ),
        )
        // 은행장은 나갈 수도 내보내질 수도 없다 — 창설과 같은 트랜잭션에서 회원이 된다.
        if (created.visibility == PointVisibility.PRIVATE) {
            membershipRepository.saveAndFlush(Membership(pointType = created, user = issuer))
        }
        return pointTypeResponses.of(created, creatorId)
    }

    /** 소개는 이력에 남지 않는다 — 약속이 아니라 소개이므로 마지막에 쓴 것이 지금 값이다. */
    @Transactional
    fun changeDescription(actorId: Long, publicId: String, description: String?): PointTypeResponse {
        val trimmed = description?.trim()
        if (trimmed != null && trimmed.filterNot(Char::isWhitespace).length > 60) {
            throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "요청 형식 오류")
        }
        val pointType = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?.takeIf { bankAccess.canReach(it, actorId) }
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        if (pointType.issuer.id != actorId) {
            throw DomainFailureException(FailureCode.NOT_ISSUER, "발행자가 아님")
        }

        pointType.description = trimmed?.takeIf { it.isNotEmpty() }
        pointTypeRepository.save(pointType)
        return pointTypeResponses.of(pointType, actorId)
    }

    private fun BigDecimal.asSafeInteger(): Long? =
        stripTrailingZeros().takeIf { it.scale() <= 0 }
            ?.runCatching { longValueExact() }?.getOrNull()
            ?.takeIf { it <= MAX_SAFE_INTEGER }
}

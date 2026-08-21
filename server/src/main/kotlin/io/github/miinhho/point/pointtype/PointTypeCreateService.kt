package io.github.miinhho.point.pointtype

import io.github.miinhho.point.ledger.Account
import io.github.miinhho.point.ledger.AccountKind
import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID
import io.github.miinhho.point.membership.BankAccess
import io.github.miinhho.point.membership.Membership
import io.github.miinhho.point.membership.MembershipRepository

// JS Number.MAX_SAFE_INTEGER — 프론트가 안전하게 다룰 수 있는 정수 상한. 근거: docs/API.md
private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

@Service
class PointTypeCreateService(
    private val pointTypeRepository: PointTypeRepository,
    private val membershipRepository: MembershipRepository,
    private val userRepository: UserRepository,
    private val pointTypeResponses: PointTypeResponses,
    private val accountRepository: AccountRepository,
    private val bankAccess: BankAccess,
) {
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(key: String, viewerId: Long): PointTypeResponse? =
        pointTypeRepository.findByIssuerIdAndIdempotencyKey(viewerId, key)?.let { pointTypeResponses.of(it, viewerId) }

    /** 발행자 자격을 심사하지 않는다 — 누구나 만들고 상한도 자기가 정한다 (docs/JOURNEY.md 여정 9). */
    @Transactional
    fun create(creatorId: Long, idempotencyKey: String, request: CreatePointTypeRequest): PointTypeResponse {
        val name = request.name?.trim().orEmpty()
        val emoji = request.emoji?.let(AllowedEmoji::normalize)
        val description = request.description?.trim()
        val accent = request.accent?.trim()?.uppercase()
        val issueCap = request.issueCap?.asSafeInteger()
        val visibility = request.visibility?.trim()?.uppercase()
            ?.let { name -> PointVisibility.entries.find { it.name == name } }

        // message 는 화면에 뿌리는 글이 아니라 붙이는 사람이 읽는 글이다 — 어느 필드인지
        // 말하지 않으면 계약이 어긋났을 때 그것을 찾는 데 시간이 든다.
        val wrong = when {
            name.filterNot(Char::isWhitespace).length !in 1..12 -> "name"
            emoji == null -> "emoji"
            description != null && description.filterNot(Char::isWhitespace).length > 60 -> "description"
            accent == null || PointAccent.entries.none { it.name == accent } -> "accent"
            issueCap == null || issueCap <= 0 -> "issueCap"
            visibility == null -> "visibility"
            else -> null
        }
        if (wrong != null) throw DomainFailureException(FailureCode.MALFORMED_REQUEST, "$wrong 이(가) 계약과 다름")

        val issuer = userRepository.getReferenceById(creatorId)
        val created = pointTypeRepository.saveAndFlush(
            PointType(
                name = name,
                emoji = emoji!!,
                description = description?.takeIf { it.isNotEmpty() },
                issuer = issuer,
                accent = PointAccent.valueOf(accent!!),
                visibility = visibility!!,
                idempotencyKey = idempotencyKey,
            ),
        )
        openIssuance(created, issueCap!!)

        // 은행장은 나갈 수도 내보내질 수도 없다 — 창설과 같은 트랜잭션에서 회원이 된다.
        if (created.visibility == PointVisibility.PRIVATE) {
            membershipRepository.saveAndFlush(Membership(pointType = created, user = issuer))
        }
        return pointTypeResponses.of(created, creatorId)
    }

    /**
     * 발행 계정은 포인트가 나는 순간 **상한을 갖고** 함께 난다. 보유자 계정과 달리 미리 있어야 한다 —
     * 상한을 보는 쪽이 잠글 행이고, 없으면 첫 발행과 첫 상한 변경이 그것을 만들려고 겹친다.
     *
     * private 인 것이 이 성질을 지킨다. 포인트를 만드는 길이 이 클래스 하나뿐이고 밖에서는
     * 계정을 열 수 없으므로, 계정 없는 포인트를 만드는 코드가 아예 컴파일되지 않는다.
     */
    private fun openIssuance(pointType: PointType, issueCap: Long) {
        accountRepository.saveAndFlush(
            Account(pointTypeId = pointType.id!!, userId = null, kind = AccountKind.ISSUANCE, issueCap = issueCap),
        )
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

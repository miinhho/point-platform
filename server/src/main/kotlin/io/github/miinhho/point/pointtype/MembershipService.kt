package io.github.miinhho.point.pointtype

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class MembershipService(
    private val pointTypeRepository: PointTypeRepository,
    private val membershipRepository: MembershipRepository,
    private val inviteRepository: InviteRepository,
    private val userRepository: UserRepository,
    private val pointTypeResponses: PointTypeResponses,
    private val bankAccess: BankAccess,
) {
    @Transactional
    fun invite(bankPublicId: String, issuerId: Long, userPublicId: String?, idempotencyKey: String): InviteResponse {
        val pointType = requirePrivateBank(bankPublicId, issuerId)
        if (pointType.issuer.id != issuerId) throw failure(FailureCode.NOT_ISSUER, "발행자가 아님")

        val invited = userPublicId?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            ?.let(userRepository::findByPublicId)
            ?: throw failure(FailureCode.RECIPIENT_NOT_FOUND, "대상 없음")

        // 초대는 은행장의 행동이라 「내가 방금 초대했다」가 사실이 아니면 그렇게 말해야 한다.
        if (membershipRepository.existsById(MembershipId(pointType.id!!, invited.id!!))) {
            throw failure(FailureCode.ALREADY_MEMBER, "이미 회원")
        }
        // 살아 있는 초대가 있으면 그것이 답이다. 소진된 것은 새 초대를 막지 않는다.
        inviteRepository.findByPointTypeIdAndUserIdAndSpentAtIsNull(pointType.id!!, invited.id!!)
            ?.let { return it.toResponse(issuerId) }

        val created = inviteRepository.saveAndFlush(
            Invite(pointType = pointType, user = invited, by = pointType.issuer, idempotencyKey = idempotencyKey),
        )
        return created.toResponse(issuerId)
    }

    /** 같은 키로 다시 오면 그때의 결과를 준다 — 대상이 달라도 키가 답하는 질문은 하나다. */
    @Transactional(readOnly = true)
    fun findByIdempotencyKey(issuerId: Long, idempotencyKey: String): InviteResponse? =
        inviteRepository.findByByIdAndIdempotencyKey(issuerId, idempotencyKey)?.toResponse(issuerId)

    /** 살아 있는 것만 담는다 — 소진된 초대가 초대함에 남으면 내보내진 사람이 걸어 들어온다. */
    @Transactional(readOnly = true)
    fun received(userId: Long): List<InviteResponse> =
        inviteRepository.findByUserIdAndSpentAtIsNullOrderByCreatedAtDesc(userId).map { it.toResponse(userId) }

    /**
     * 수락. 은행을 가리킨다 — 초대는 소진되면 새 행이 나므로 화면이 쥔 id 는 낡는다.
     * 답은 소진 여부가 아니라 **지금 회원인가**로 갈린다 (docs/API.md 「초대」).
     */
    @Transactional
    fun accept(bankPublicId: String, userId: Long): PointTypeResponse {
        val pointType = requirePrivateBank(bankPublicId, userId)
        if (!membershipRepository.existsById(MembershipId(pointType.id!!, userId))) {
            val invite = inviteRepository.findByPointTypeIdAndUserIdAndSpentAtIsNull(pointType.id!!, userId)
                ?: throw failure(FailureCode.INVITE_NOT_FOUND, "초대 없음")
            invite.spend()
            membershipRepository.saveAndFlush(
                Membership(pointType = pointType, user = userRepository.getReferenceById(userId)),
            )
        }
        return pointTypeResponses.of(pointType, userId)
    }

    /** 나간다. 답은 「지금 회원이 아닌가」 하나로 갈린다 — 근거: docs/API.md 「나가기」. */
    @Transactional
    fun leave(bankPublicId: String, userId: Long) {
        // 없는 id 도 닿지 못하는 은행도 여기서는 같은 답이다. 가르면 잔액 0 으로 나간 사람이
        // 다시 눌렀을 때 방금까지 보던 은행을 「없어요」로 듣는다.
        val bank = runCatching { UUID.fromString(bankPublicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?: return
        if (bank.visibility == PointVisibility.PUBLIC) {
            throw failure(FailureCode.NOT_A_PRIVATE_BANK, "공개 은행에는 회원이 없음")
        }

        if (bank.issuer.id == userId) throw failure(FailureCode.ISSUER_CANNOT_LEAVE, "은행장은 나갈 수 없음")
        removeMember(bank, userId)
    }

    /** 내보낸다. 나가기와 같은 일이고 누가 정했느냐만 다르다. */
    @Transactional
    fun remove(bankPublicId: String, issuerId: Long, targetPublicId: String) {
        val pointType = requirePrivateBank(bankPublicId, issuerId)
        if (pointType.issuer.id != issuerId) throw failure(FailureCode.NOT_ISSUER, "발행자가 아님")

        val target = runCatching { UUID.fromString(targetPublicId) }.getOrNull()
            ?.let(userRepository::findByPublicId)
            ?: throw failure(FailureCode.RECIPIENT_NOT_FOUND, "대상 없음")
        if (pointType.issuer.id == target.id) throw failure(FailureCode.ISSUER_CANNOT_LEAVE, "은행장은 내보낼 수 없음")
        removeMember(pointType, target.id!!)
    }

    // 잔액도 초대도 건드리지 않는다. 회원은 살아 있는 초대를 갖지 않으므로 여기서 끝낼
    // 초대가 없고, 대기 중인 초대를 끝내면 계약에 없는 「초대 취소」가 된다.
    private fun removeMember(pointType: PointType, userId: Long) =
        membershipRepository.deleteById(MembershipId(pointType.id!!, userId))

    private fun requirePrivateBank(publicId: String, viewerId: Long): PointType {
        val pointType = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?.takeIf { bankAccess.canReach(it, viewerId) }
            ?: throw failure(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")
        if (pointType.visibility == PointVisibility.PUBLIC) {
            throw failure(FailureCode.NOT_A_PRIVATE_BANK, "공개 은행에는 회원이 없음")
        }
        return pointType
    }

    private fun failure(code: FailureCode, message: String) = DomainFailureException(code, message)

    private fun Invite.toResponse(viewerId: Long) = InviteResponse(
        id = publicId.toString(),
        pointType = pointTypeResponses.of(pointType, viewerId),
        byId = by.publicId.toString(),
        byHandle = by.handle,
        createdAt = createdAt,
    )
}

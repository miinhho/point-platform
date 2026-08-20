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
     * 수락. 답은 **소진 여부가 아니라 지금 회원인가**로 갈린다 — 멱등의 기준이
     * 「그가 원한 결과가 이미 있는가」이고, 수락을 누른 사람이 원한 것은 회원이 되는 것이다.
     */
    @Transactional
    fun accept(invitePublicId: String, userId: Long): PointTypeResponse {
        val invite = runCatching { UUID.fromString(invitePublicId) }.getOrNull()
            ?.let(inviteRepository::findByPublicId)
            ?.takeIf { it.user.id == userId }
            ?: throw failure(FailureCode.INVITE_NOT_FOUND, "초대 없음")

        if (!membershipRepository.existsById(MembershipId(invite.pointType.id!!, userId))) {
            // 소진된 초대로는 걸어 들어올 수 없다. 내보내진 사람이 돌아오는 길이 여기서 막힌다.
            if (invite.spentAt != null) throw failure(FailureCode.INVITE_NOT_FOUND, "소진된 초대")
            invite.spend()
            membershipRepository.saveAndFlush(Membership(pointType = invite.pointType, user = invite.user))
        }
        return pointTypeResponses.of(invite.pointType, userId)
    }

    /** 나간다. 은행장은 나갈 수 없다 — 발행할 사람이 없는 은행이 된다. */
    @Transactional
    fun leave(bankPublicId: String, userId: Long) {
        val pointType = lockPrivateBank(bankPublicId, userId)
        if (pointType.issuer.id == userId) throw failure(FailureCode.ISSUER_CANNOT_LEAVE, "은행장은 나갈 수 없음")
        removeMember(pointType, userId)
    }

    /** 내보낸다. 나가기와 같은 일이고 누가 정했느냐만 다르다. */
    @Transactional
    fun remove(bankPublicId: String, issuerId: Long, targetPublicId: String) {
        val pointType = lockPrivateBank(bankPublicId, issuerId)
        if (pointType.issuer.id != issuerId) throw failure(FailureCode.NOT_ISSUER, "발행자가 아님")

        val target = runCatching { UUID.fromString(targetPublicId) }.getOrNull()
            ?.let(userRepository::findByPublicId)
            ?: throw failure(FailureCode.RECIPIENT_NOT_FOUND, "대상 없음")
        if (pointType.issuer.id == target.id) throw failure(FailureCode.ISSUER_CANNOT_LEAVE, "은행장은 내보낼 수 없음")
        removeMember(pointType, target.id!!)
    }

    // 잔액은 건드리지 않는다. 쓸 수 없는 채로 남는 것이 설계다.
    private fun removeMember(pointType: PointType, userId: Long) {
        val membership = MembershipId(pointType.id!!, userId)
        if (!membershipRepository.existsById(membership)) return
        // 회원 자격과 그 초대가 함께 끝난다. 회원이었던 사람만이다 — 대기 중인 초대를
        // 여기서 끝내면 계약에 없는 「초대 취소」가 된다.
        inviteRepository.findByPointTypeIdAndUserIdAndSpentAtIsNull(pointType.id!!, userId)?.spend()
        membershipRepository.deleteById(membership)
    }

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

    // 은행 행을 잠그고 센다 — 은행장 자격을 읽고 지우는 사이에 다른 요청이 끼면
    // 회원이 0 인 은행이 생긴다.
    private fun lockPrivateBank(publicId: String, viewerId: Long): PointType {
        val reachable = requirePrivateBank(publicId, viewerId)
        return pointTypeRepository.findForUpdate(reachable.id!!)!!
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

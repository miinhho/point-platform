package io.github.miinhho.point.pointtype

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.User
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
        // 이미 초대된 사람을 다시 초대하면 같은 초대다.
        inviteRepository.findByPointTypeIdAndUserId(pointType.id!!, invited.id!!)?.let { return it.toResponse(issuerId) }

        val created = inviteRepository.saveAndFlush(
            Invite(pointType = pointType, user = invited, by = pointType.issuer, idempotencyKey = idempotencyKey),
        )
        return created.toResponse(issuerId)
    }

    // 회원이 된 은행의 초대는 담기지 않는다 — 수락하면 사라지는 것이 이것이다.
    @Transactional(readOnly = true)
    fun received(userId: Long): List<InviteResponse> = inviteRepository.findByUserIdOrderByCreatedAtDesc(userId)
        .filterNot { membershipRepository.existsById(MembershipId(it.pointType.id!!, userId)) }
        .map { it.toResponse(userId) }

    /**
     * 수락. **이미 회원이면 성공이다** — 멱등은 「그가 원한 결과가 이미 있는가」로 판단하고,
     * 수락을 누른 사람이 원한 것은 회원이 되는 것이다.
     */
    @Transactional
    fun accept(invitePublicId: String, userId: Long): PointTypeResponse {
        // 행을 지우지 않는다. 지우면 다시 누른 사람에게 그 id 가 무엇이었는지 답할 수 없고,
        // 「응답 못 받고 다시 누른 사람에게 실패를 주지 않는다」가 성립하지 않는다.
        // 사라지는 것은 GET /api/invites 에서다.
        val invite = runCatching { UUID.fromString(invitePublicId) }.getOrNull()
            ?.let(inviteRepository::findByPublicId)
            ?.takeIf { it.user.id == userId }
            ?: throw failure(FailureCode.INVITE_NOT_FOUND, "초대 없음")

        join(invite.pointType, invite.user)
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
    private fun removeMember(pointType: PointType, userId: Long) =
        membershipRepository.deleteById(MembershipId(pointType.id!!, userId))

    private fun join(pointType: PointType, user: User) {
        if (membershipRepository.existsById(MembershipId(pointType.id!!, user.id!!))) return
        membershipRepository.saveAndFlush(Membership(pointType = pointType, user = user))
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

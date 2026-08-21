package io.github.miinhho.point.pointtype

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.user.UserResponse
import io.github.miinhho.point.user.toResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class PointTypeQueryService(
    private val pointTypeRepository: PointTypeRepository,
    private val bankAccess: BankAccess,
    private val pointTypeResponses: PointTypeResponses,
    private val membershipRepository: MembershipRepository,
    private val userRepository: UserRepository,
) {
    @Transactional(readOnly = true)
    fun all(viewerId: Long): List<PointTypeResponse> {
        val relations = bankAccess.relationsOf(viewerId)
        val visible = pointTypeRepository.publicOrRelated(relations.ids(BankAccess.REACHES)).filter { bankAccess.canReach(it, relations) }
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

    /**
     * 회원 목록. 부르는 사람에 따라 셋으로 갈린다 (docs/API.md 「회원 자격」).
     *
     * 비회원에게 `404` 를 주지 않는 이유는 감출 것이 남아 있지 않기 때문이다 — 잔액이
     * 있어 은행 페이지를 이미 본다.
     */
    @Transactional(readOnly = true)
    fun members(publicId: String, viewerId: Long): List<UserResponse> {
        val pointType = runCatching { UUID.fromString(publicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId)
            ?.takeIf { bankAccess.canReach(it, viewerId) }
            ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")

        if (pointType.visibility == PointVisibility.PUBLIC) {
            throw DomainFailureException(FailureCode.NOT_A_PRIVATE_BANK, "공개 은행에는 회원이 없음")
        }
        val members = membershipRepository.userIdsOf(pointType.id!!)
        if (viewerId !in members) throw DomainFailureException(FailureCode.NOT_MEMBER, "회원이 아님")

        val shared = userRepository.sharedNames()
        return userRepository.findAllById(members).map { it.toResponse(shared) }
    }
}

package io.github.miinhho.point.transfer

import io.github.miinhho.point.pointtype.membership.BankAccess
import io.github.miinhho.point.pointtype.membership.MembershipRepository
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
import org.springframework.data.domain.Limit
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.user.UserResponse
import io.github.miinhho.point.user.toResponse

@Service
class RecipientService(
    private val userRepository: UserRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val membershipRepository: MembershipRepository,
    private val transferRepository: TransferRepository,
    private val bankAccess: BankAccess,
) {
    // 근거: docs/API.md — 결과 안에서만 겹침을 세면 핸들로 검색해 한 명만 나올 때
    // 동명이인 방어가 꺼진다. 매치된 이름 전원을 함께 담는다.
    @Transactional(readOnly = true)
    fun search(query: String?, pointTypePublicId: String?, meId: Long): List<UserResponse> {
        val shared = userRepository.sharedNames()
        val members = membersOf(pointTypePublicId, meId)
        val needle = query?.trim()?.lowercase()
        // 검색어가 있으면 DB 가 거른다 — 전부 읽어 메모리에서 거르면 사람이 늘수록 무거워진다.
        val candidates = if (needle.isNullOrEmpty()) all(members) else userRepository.matching(needle)
        return candidates
            .filter { it.id != meId && (members == null || it.id in members) }
            .map { it.toResponse(shared) }
    }

    // 근거: docs/API.md — 최근 대상은 포인트별로 다르다. 최신순, 대상 중복 제거.
    @Transactional(readOnly = true)
    fun recent(pointTypePublicId: String, limit: Int, userId: Long): List<UserResponse> {
        val pointType = findPointType(pointTypePublicId) ?: return emptyList()
        val members = membersOf(pointType)
        // 문은 검색과 같다 — 회원인가. 도달성으로 열면 잔액 남은 채 나간 사람에게 「지금도
        // 회원인 사람」의 이름이 나간다 (docs/API.md 「필터 인자」).
        if (members != null && userId !in members) return emptyList()

        val seen = LinkedHashSet<Long>()
        for (transfer in transferRepository.sentByPointType(userId, pointType.id!!, Limit.of(200))) {
            if (members != null && transfer.to.id !in members) continue
            seen.add(transfer.to.id!!)
            if (seen.size >= limit) break
        }
        val shared = userRepository.sharedNames()
        return seen.mapNotNull { userRepository.findById(it).orElse(null) }.map { it.toResponse(shared) }
    }

    private fun all(members: Set<Long>?): List<User> =
        if (members == null) userRepository.findAll() else userRepository.findAllById(members)

    /**
     * 좁힐 회원 집합. 공개 은행이거나 좁히지 않으면 `null`(좁히지 않는다)이고, 명부를 볼 수
     * 없으면 [NOTHING] 이라 아무도 안 남는다 — 회원이 아닌 것도 없는 것도 같은 `[]` 다.
     *
     * 둘을 같은 `null` 로 두면 공개 은행이 「볼 수 없다」와 같아진다.
     */
    private fun membersOf(pointTypePublicId: String?, meId: Long): Set<Long>? {
        if (pointTypePublicId.isNullOrBlank()) return null
        val pointType = findPointType(pointTypePublicId)?.takeIf { bankAccess.canReach(it, meId) }
            ?: return NOTHING
        val members = membersOf(pointType) ?: return null
        return if (meId in members) members else NOTHING
    }

    /** 회원 집합. 공개 은행에는 회원이 없으므로 null 이고, 그것은 「좁히지 않는다」는 뜻이다. */
    private fun membersOf(pointType: PointType): Set<Long>? =
        if (pointType.visibility == PointVisibility.PRIVATE) membershipRepository.userIdsOf(pointType.id!!) else null

    private companion object {
        /** 볼 수 없다는 답. 빈 집합으로 좁히면 결과가 비어 「없다」와 같아진다. */
        val NOTHING: Set<Long> = emptySet()
    }

    private fun findPointType(publicId: String) =
        runCatching { UUID.fromString(publicId) }.getOrNull()?.let(pointTypeRepository::findByPublicId)
}

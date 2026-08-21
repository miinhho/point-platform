package io.github.miinhho.point.user

import io.github.miinhho.point.pointtype.BankAccess
import io.github.miinhho.point.pointtype.MembershipRepository
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.transfer.TransferRepository
import org.springframework.data.domain.Limit
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class UserQueryService(
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
        val candidates = reachableUsers(pointTypePublicId, meId) ?: return emptyList()
        val others = candidates.filterNot { it.id == meId }
        val needle = query?.trim()?.lowercase()
        if (needle.isNullOrEmpty()) return others.map { it.toResponse(shared) }

        val matched = others.filter { it.name.contains(needle) || it.handle.lowercase().contains(needle) }
        val names = matched.map { it.name }.toSet()
        return others.filter { it.name in names }.map { it.toResponse(shared) }
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

    /** 비공개 은행이면 회원으로 좁힌다. 닿을 수 없거나 내가 회원이 아니면 null — 명부가 새지 않는다. */
    private fun reachableUsers(pointTypePublicId: String?, meId: Long): List<User>? {
        if (pointTypePublicId.isNullOrBlank()) return userRepository.findAll()
        val pointType = findPointType(pointTypePublicId)?.takeIf { bankAccess.canReach(it, meId) } ?: return null
        val members = membersOf(pointType) ?: return userRepository.findAll()
        if (meId !in members) return null
        return userRepository.findAllById(members)
    }

    /** 회원 집합. 공개 은행에는 회원이 없으므로 null 이고, 그것은 「좁히지 않는다」는 뜻이다. */
    private fun membersOf(pointType: PointType): Set<Long>? =
        if (pointType.visibility == PointVisibility.PRIVATE) membershipRepository.userIdsOf(pointType.id!!) else null

    private fun findPointType(publicId: String) =
        runCatching { UUID.fromString(publicId) }.getOrNull()?.let(pointTypeRepository::findByPublicId)
}

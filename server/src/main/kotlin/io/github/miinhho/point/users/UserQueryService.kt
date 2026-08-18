package io.github.miinhho.point.users

import io.github.miinhho.point.domain.pointtype.PointTypeRepository
import io.github.miinhho.point.domain.transfer.TransferRepository
import io.github.miinhho.point.domain.user.User
import io.github.miinhho.point.domain.user.UserRepository
import org.springframework.data.domain.Limit
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class UserQueryService(
    private val userRepository: UserRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val transferRepository: TransferRepository,
) {
    // 근거: docs/API.md — 결과 안에서만 겹침을 세면 핸들로 검색해 한 명만 나올 때
    // 동명이인 방어가 꺼진다. 매치된 이름 전원을 함께 담는다.
    @Transactional(readOnly = true)
    fun search(query: String?, meId: Long): List<User> {
        val others = userRepository.findAll().filterNot { it.id == meId }
        val needle = query?.trim()?.lowercase()
        if (needle.isNullOrEmpty()) return others

        val matched = others.filter { it.name.contains(needle) || it.handle.lowercase().contains(needle) }
        val names = matched.map { it.name }.toSet()
        return others.filter { it.name in names }
    }

    // 근거: docs/API.md — 최근 대상은 포인트별로 다르다. 최신순, 대상 중복 제거.
    @Transactional(readOnly = true)
    fun recent(pointTypePublicId: String, limit: Int, userId: Long): List<User> {
        val pointType = runCatching { UUID.fromString(pointTypePublicId) }.getOrNull()
            ?.let(pointTypeRepository::findByPublicId) ?: return emptyList()

        val seen = LinkedHashSet<Long>()
        for (transfer in transferRepository.sentByPointType(userId, pointType.id!!, Limit.of(200))) {
            seen.add(transfer.to.id!!)
            if (seen.size >= limit) break
        }
        return seen.mapNotNull { userRepository.findById(it).orElse(null) }
    }
}

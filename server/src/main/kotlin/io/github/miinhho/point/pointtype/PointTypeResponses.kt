package io.github.miinhho.point.pointtype

import io.github.miinhho.point.ledger.AccountRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

// 내보내는 경로마다 각자 조립하면 새 경로가 생길 때 필드가 조용히 빠진다.
// 지연 연관관계(issuer)를 건드리므로 트랜잭션 안이어야 한다 — open-in-view=false 다.
@Component
@Transactional(readOnly = true)
class PointTypeResponses(
    private val pointTypeRepository: PointTypeRepository,
    private val membershipRepository: MembershipRepository,
    private val accountRepository: AccountRepository,
    private val bankAccess: BankAccess,
) {
    fun of(pointType: PointType, viewerId: Long): PointTypeResponse = of(listOf(pointType), viewerId).first()

    fun of(pointTypes: List<PointType>, viewerId: Long): List<PointTypeResponse> {
        val sharedNames = pointTypeRepository.sharedNames()
        val memberCounts = memberCounts(pointTypes)
        // 은행마다 물으면 N+1 이다 — 보는 사람 기준으로 한 번씩만 모은다.
        val memberOf = bankAccess.memberOf(viewerId)
        val invitedTo = bankAccess.invitedTo(viewerId)
        val issued = issuedOf(pointTypes)
        return pointTypes.map { pointType ->
            pointType.toResponse(
                viewerId,
                sharedNames,
                memberCounts[pointType.id],
                bankAccess.membershipOf(pointType, memberOf, invitedTo),
                issued[pointType.id] ?: 0,
            )
        }
    }

    // 유통량의 정본은 발행 계정 잔액이다 — 그 값의 부호를 뒤집은 것이 발행량이다.
    // 은행마다 물으면 목록에서 N+1 이다.
    private fun issuedOf(pointTypes: List<PointType>): Map<Long, Long> {
        val ids = pointTypes.mapNotNull { it.id }
        if (ids.isEmpty()) return emptyMap()
        return accountRepository.issuedOf(ids).associate { it[0] as Long to it[1] as Long }
    }

    // 공개 은행에는 회원이 없다. 0 을 실으면 「회원이 없는 은행」으로 읽히므로 null 이다.
    private fun memberCounts(pointTypes: List<PointType>): Map<Long, Long> {
        val ids = pointTypes.filter { it.visibility == PointVisibility.PRIVATE }.mapNotNull { it.id }
        if (ids.isEmpty()) return emptyMap()
        val counted = membershipRepository.countsOf(ids).associate { it[0] as Long to it[1] as Long }
        return ids.associateWith { counted[it] ?: 0 }
    }
}

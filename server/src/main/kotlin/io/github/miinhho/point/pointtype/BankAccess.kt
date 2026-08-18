package io.github.miinhho.point.pointtype

import io.github.miinhho.point.wallet.BalanceRepository
import org.springframework.stereotype.Service

/** 누가 이 은행에 닿을 수 있는가. 근거: docs/API.md 「회원 자격」. */
@Service
class BankAccess(
    private val membershipRepository: MembershipRepository,
    private val balanceRepository: BalanceRepository,
) {
    // 나갔거나 내보내진 사람이 잔액으로 포함된다. 지갑이 그 카드를 계속 실어 주므로
    // 페이지만 감추면 같은 사실을 두 곳이 다르게 말한다.
    fun reachablePrivateIds(viewerId: Long): Set<Long> =
        membershipRepository.pointTypeIdsOf(viewerId) + balanceRepository.pointTypeIdsHeldBy(viewerId)

    // 공개이거나 은행장이면 조회하지 않는다 — 단락되도록 집합을 인자로 받지 않는다.
    fun canReach(pointType: PointType, viewerId: Long): Boolean =
        pointType.visibility == PointVisibility.PUBLIC ||
            pointType.issuer.id == viewerId ||
            pointType.id in reachablePrivateIds(viewerId)

    /** 공개 은행에는 회원이 없다 — 누구나 주고받으므로 언제나 참이다. */
    fun isMember(pointType: PointType, userId: Long): Boolean =
        pointType.visibility == PointVisibility.PUBLIC ||
            membershipRepository.existsById(MembershipId(pointType.id!!, userId))

    /** 목록용. 은행마다 부르면 N+1 이라 도달 가능한 집합을 한 번 모아서 넘긴다. */
    fun canReach(pointType: PointType, viewerId: Long, reachablePrivateIds: Set<Long>): Boolean =
        pointType.visibility == PointVisibility.PUBLIC ||
            pointType.issuer.id == viewerId ||
            pointType.id in reachablePrivateIds
}

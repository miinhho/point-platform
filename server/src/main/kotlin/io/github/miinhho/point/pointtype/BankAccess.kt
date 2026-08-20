package io.github.miinhho.point.pointtype

import io.github.miinhho.point.ledger.AccountRepository
import org.springframework.stereotype.Service

/** 누가 이 은행에 닿을 수 있는가. 근거: docs/API.md 「회원 자격」. */
@Service
class BankAccess(
    private val membershipRepository: MembershipRepository,
    private val inviteRepository: InviteRepository,
    private val accountRepository: AccountRepository,
) {
    // 공개이거나 은행장이면 뒤엣것을 조회하지 않는다 — any 가 첫 참에서 멈춘다.
    fun canReach(pointType: PointType, viewerId: Long): Boolean =
        REACHES.any { holds(it, pointType, viewerId) }

    private fun holds(relation: Relation, pointType: PointType, viewerId: Long): Boolean = when (relation) {
        Relation.PUBLIC -> pointType.visibility == PointVisibility.PUBLIC
        Relation.ISSUER -> pointType.issuer.id == viewerId
        Relation.MEMBER -> pointType.id in memberOf(viewerId)
        Relation.INVITED -> pointType.id in invitedTo(viewerId)
        Relation.HOLDS_BALANCE -> pointType.id in accountRepository.pointTypeIdsHeldBy(viewerId)
    }

    /**
     * 목록용. 은행마다 물으면 N+1 이라 보는 사람 기준으로 한 번씩만 모은다.
     *
     * 초대받은 사람은 아직 회원이 아니어도 판단하러 페이지에 와야 하고, 나갔거나 내보내진
     * 사람이 잔액으로 들어온다 — 지갑이 그 카드를 계속 실어 주므로 페이지만 감추면 같은
     * 사실을 두 곳이 다르게 말한다.
     */
    fun relationsOf(viewerId: Long): Relations = Relations(
        viewerId = viewerId,
        memberOf = memberOf(viewerId),
        invitedTo = invitedTo(viewerId),
        holds = accountRepository.pointTypeIdsHeldBy(viewerId),
    )

    class Relations(
        private val viewerId: Long,
        private val memberOf: Set<Long>,
        private val invitedTo: Set<Long>,
        private val holds: Set<Long>,
    ) {
        fun of(pointType: PointType): Set<Relation> = buildSet {
            if (pointType.visibility == PointVisibility.PUBLIC) add(Relation.PUBLIC)
            if (pointType.issuer.id == viewerId) add(Relation.ISSUER)
            if (pointType.id in memberOf) add(Relation.MEMBER)
            if (pointType.id in invitedTo) add(Relation.INVITED)
            if (pointType.id in holds) add(Relation.HOLDS_BALANCE)
        }

        fun any(pointType: PointType, opens: Set<Relation>): Boolean = of(pointType).any { it in opens }
    }

    /** 공개 은행에는 회원이 없다 — 누구나 주고받으므로 언제나 참이다. */
    fun isMember(pointType: PointType, userId: Long): Boolean =
        pointType.visibility == PointVisibility.PUBLIC ||
            membershipRepository.existsById(MembershipId(pointType.id!!, userId))

    fun memberOf(viewerId: Long): Set<Long> = membershipRepository.pointTypeIdsOf(viewerId)

    /** 소진된 초대는 담기지 않는다 — 내보내진 사람은 초대받은 사람이 아니다. */
    fun invitedTo(viewerId: Long): Set<Long> = inviteRepository.pointTypeIdsInvitedTo(viewerId)

    // 공개 은행에는 회원 개념이 없어서 null 이다. "outsider" 로 두면 화면이
    // 「회원이 아니에요」를 그릴 자리를 찾는다 — memberCount 를 null 로 둔 것과 같다.
    fun membershipOf(pointType: PointType, memberOf: Set<Long>, invitedTo: Set<Long>): String? = when {
        pointType.visibility == PointVisibility.PUBLIC -> null
        pointType.id in memberOf -> "member"
        pointType.id in invitedTo -> "invited"
        else -> "outsider"
    }

    fun canReach(pointType: PointType, relations: Relations): Boolean = relations.any(pointType, REACHES)

    companion object {
        /**
         * 은행 페이지에 닿게 해 주는 관계. 지갑이 담는 것은 이 안에 있어야 한다.
         *
         * **순서가 값을 정한다** — [canReach] 가 앞에서부터 보고 첫 참에서 멈추므로
         * 조회가 드는 것([Relation.needsQuery])을 뒤에 둔다.
         */
        val REACHES: Set<Relation> = setOf(
            Relation.PUBLIC,
            Relation.ISSUER,
            Relation.MEMBER,
            Relation.INVITED,
            Relation.HOLDS_BALANCE,
        )
    }
}

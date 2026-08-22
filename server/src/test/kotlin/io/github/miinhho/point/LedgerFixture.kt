package io.github.miinhho.point

import io.github.miinhho.point.issue.IssueService
import io.github.miinhho.point.pointtype.membership.MembershipId
import io.github.miinhho.point.pointtype.membership.MembershipRepository
import io.github.miinhho.point.pointtype.membership.MembershipService
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.transfer.TransferService
import io.github.miinhho.point.user.User
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * 픽스처가 잔액을 만드는 유일한 자리. **적용부를 지난다** — 계정에 숫자를 바로 넣으면
 * 사건 없는 잔액이 남고, 그 판 위에서 도는 불변식 검사는 아무것도 지키지 않는다.
 */
@Component
class LedgerFixture(
    private val issueService: IssueService,
    private val transferService: TransferService,
    private val membershipService: MembershipService,
    private val membershipRepository: MembershipRepository,
) {
    /** 발행자가 자기 포인트를 찍는다. 발행자 지갑에 그만큼 쌓인다. */
    fun issue(pointType: PointType, amount: Long): Unit =
        issueService.commit(pointType.issuer.id!!, key(), pointType.publicId.toString(), amount).let { }

    /** 발행자가 회원에게 보낸다. 비공개 은행이면 회원이어야 하므로 먼저 들여보낸다. */
    fun give(pointType: PointType, to: User, amount: Long) {
        issue(pointType, amount)
        if (pointType.visibility == PointVisibility.PRIVATE) join(pointType, to)
        transferService.commitTransfer(pointType.issuer.id!!, key(), pointType.publicId.toString(), to.publicId.toString(), amount)
    }

    /** 받은 적 있고 지금은 회원이 아닌 사람 — 잔액이 남았든 다 썼든. */
    fun giveThenLeave(pointType: PointType, to: User, amount: Long) {
        give(pointType, to, amount)
        membershipService.leave(pointType.publicId.toString(), to.id!!)
    }

    /** 이미 회원이면 그대로 둔다 — 픽스처가 부르는 순서에 결과가 달라지면 판이 흔들린다. */
    fun join(pointType: PointType, who: User) {
        val bank = pointType.publicId.toString()
        if (membershipRepository.existsById(MembershipId(pointType.id!!, who.id!!))) return
        membershipService.invite(bank, pointType.issuer.id!!, who.publicId.toString(), key())
        membershipService.accept(bank, who.id!!)
    }

    private fun key() = UUID.randomUUID().toString()
}

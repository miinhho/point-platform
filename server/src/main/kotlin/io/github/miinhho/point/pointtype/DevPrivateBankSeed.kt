package io.github.miinhho.point.pointtype

import io.github.miinhho.point.issue.IssueService
import io.github.miinhho.point.transfer.TransferService
import io.github.miinhho.point.user.User
import io.github.miinhho.point.user.UserRepository
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import java.math.BigDecimal

/**
 * 비공개 은행 하나와 **관계 넷**을 채운다 — 회원 · 잔액 0 인 회원 · 초대만 받은 사람 ·
 * 잔액이 남은 비회원.
 *
 * 넷이 다 있어야 `membership` 의 세 값과 수락 실패 두 갈래, 그리고 「들어왔지만 아직 없는
 * 0」의 카드를 실서버에서 잴 수 있다. 손으로
 * 만들면 판을 다시 만들 때마다 사라지고, 그때마다 회원 자격 계약 전체가 잴 수 없는 상태로
 * 돌아간다.
 *
 * 화면이 지나는 서비스만 쓴다. 계정에 숫자를 바로 넣으면 원장에 사건 없는 잔액이 남고,
 * 전체를 한 트랜잭션에 묶으면 계정 삽입이 별도 트랜잭션이라 은행 행의 FK 락을 서로 기다린다.
 */
@Component
@Order(2)
@ConditionalOnProperty("point.seed-users", havingValue = "true")
class DevPrivateBankSeed(
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
    private val pointTypeCreateService: PointTypeCreateService,
    private val membershipService: MembershipService,
    private val issueService: IssueService,
    private val transferService: TransferService,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        if (pointTypeRepository.findAll().any { it.name == BANK }) return
        val issuer = user("@onmart") ?: return
        val member = user("@jisoo") ?: return
        val invited = user("@nara") ?: return
        val left = user("@mose") ?: return
        val empty = user("@jisu") ?: return

        val bank = pointTypeCreateService.create(
            issuer.id!!,
            "seed-bank",
            CreatePointTypeRequest(
                name = BANK,
                emoji = "🎪",
                description = "관계 셋이 들어 있는 개발용 은행이에요.",
                accent = "purple",
                issueCap = BigDecimal(1_000_000),
                visibility = "private",
            ),
        ).id

        issueService.commit(issuer.id!!, "seed-issue", bank, 200_000)

        join(bank, issuer, member, "seed-invite-member")
        transferService.commitTransfer(issuer.id!!, "seed-to-member", bank, member.publicId.toString(), 50_000)

        // 잔액이 남은 채 나간 사람 — membership 은 outsider 인데 은행 페이지는 계속 보인다.
        join(bank, issuer, left, "seed-invite-left")
        transferService.commitTransfer(issuer.id!!, "seed-to-left", bank, left.publicId.toString(), 30_000)
        membershipService.remove(bank, issuer.id!!, left.publicId.toString())

        // 받은 것이 없는 회원 — 세 가지 0 중 「들어왔지만 아직 없는 0」이다.
        join(bank, issuer, empty, "seed-invite-empty")

        // 초대만 받은 사람. 수락하지 않으므로 초대가 살아 있다.
        membershipService.invite(bank, issuer.id!!, invited.publicId.toString(), "seed-invite-only")
    }

    private fun join(bank: String, issuer: User, who: User, key: String) {
        membershipService.invite(bank, issuer.id!!, who.publicId.toString(), key)
        membershipService.accept(bank, who.id!!)
    }

    private fun user(handle: String): User? = userRepository.findByHandle(handle)

    private companion object {
        const val BANK = "동아리비"
    }
}

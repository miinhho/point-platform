package io.github.miinhho.point

import io.github.miinhho.point.auth.RefreshTokenRepository
import io.github.miinhho.point.issue.IssueRepository
import io.github.miinhho.point.pointtype.CapChangeRepository
import io.github.miinhho.point.pointtype.InviteRepository
import io.github.miinhho.point.pointtype.MembershipRepository
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.transfer.TransferRepository
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.ledger.AccountRepository
import org.springframework.stereotype.Component

// 테스트끼리 같은 DB 를 쓰므로 앞의 것이 남긴 행을 FK 역순으로 지우고 시작한다.
// 테스트마다 목록을 두면 테이블이 늘었을 때 한쪽만 고쳐진다.
@Component
class LedgerReset(
    private val transferRepository: TransferRepository,
    private val issueRepository: IssueRepository,
    private val capChangeRepository: CapChangeRepository,
    private val inviteRepository: InviteRepository,
    private val membershipRepository: MembershipRepository,
    private val accountRepository: AccountRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val userRepository: UserRepository,
) {
    fun wipe() {
        transferRepository.deleteAll()
        issueRepository.deleteAll()
        capChangeRepository.deleteAll()
        inviteRepository.deleteAll()
        membershipRepository.deleteAll()
        accountRepository.deleteAll()
        pointTypeRepository.deleteAll()
        refreshTokenRepository.deleteAll()
        userRepository.deleteAll()
    }
}

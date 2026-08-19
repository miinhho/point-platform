package io.github.miinhho.point

import io.github.miinhho.point.auth.RefreshTokenRepository
import io.github.miinhho.point.issue.IssueRepository
import io.github.miinhho.point.pointtype.CapChangeRepository
import io.github.miinhho.point.pointtype.MembershipRepository
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.transfer.TransferRepository
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.wallet.BalanceRepository
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component

// 테스트끼리 같은 DB 를 쓰므로 앞의 것이 남긴 행을 FK 역순으로 지우고 시작한다.
// 테스트마다 목록을 두면 테이블이 늘었을 때 한쪽만 고쳐진다.
@Component
class LedgerReset(
    private val transferRepository: TransferRepository,
    private val issueRepository: IssueRepository,
    private val capChangeRepository: CapChangeRepository,
    private val membershipRepository: MembershipRepository,
    private val balanceRepository: BalanceRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val userRepository: UserRepository,
    private val jdbc: JdbcClient,
) {
    fun wipe() {
        transferRepository.deleteAll()
        issueRepository.deleteAll()
        capChangeRepository.deleteAll()
        membershipRepository.deleteAll()
        balanceRepository.deleteAll()
        pointTypeRepository.deleteAll()
        refreshTokenRepository.deleteAll()
        userRepository.deleteAll()
        // 엔티티가 없는 표라 리포지토리로 지울 수 없다. 남으면 다음 테스트가 잠긴 채로 시작한다.
        jdbc.sql("delete from login_failures").update()
    }
}

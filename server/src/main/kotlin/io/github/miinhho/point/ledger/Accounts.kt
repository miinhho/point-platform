package io.github.miinhho.point.ledger

import io.github.miinhho.point.pointtype.PointType
import org.springframework.stereotype.Service

/** 계정을 여는 곳. 포인트를 만드는 길이 둘이라(창설·시드) 여는 코드가 두 벌이 되지 않게 모은다. */
@Service
class Accounts(private val accountRepository: AccountRepository) {
    /**
     * 발행 계정은 포인트가 나는 순간 함께 난다. 보유자 계정과 달리 미리 있어야 한다 —
     * 상한을 보는 쪽이 잠글 행이고, 없으면 첫 발행과 첫 상한 변경이 그것을 만들려고 겹친다.
     *
     * 스키마로 강제하지 못한다. 트리거는 binlog 가 켜진 MySQL 에서 SUPER 를 요구하는데
     * 앱 사용자에게 줄 권한이 아니다. 대신 [IssuanceAccountGuard] 가 부팅에서 검사한다.
     */
    fun openIssuance(pointType: PointType): Account =
        accountRepository.saveAndFlush(Account(pointType = pointType, user = null, kind = AccountKind.ISSUANCE))
}

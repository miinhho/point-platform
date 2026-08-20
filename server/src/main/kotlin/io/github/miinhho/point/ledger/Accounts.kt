package io.github.miinhho.point.ledger

import io.github.miinhho.point.pointtype.PointType
import org.springframework.stereotype.Service

/** 계정을 여는 곳. 포인트를 만드는 길이 둘이라(창설·시드) 여는 코드가 두 벌이 되지 않게 모은다. */
@Service
class Accounts(private val accountRepository: AccountRepository) {
    /**
     * 발행 계정은 포인트가 나는 순간 함께 난다. 보유자 계정과 달리 미리 있어야 한다 —
     * 상한을 보는 쪽이 잠글 행이고, 없으면 첫 발행과 첫 상한 변경이 그것을 만들려고 겹친다.
     */
    fun openIssuance(pointType: PointType): Account =
        accountRepository.saveAndFlush(Account(pointType = pointType, user = null, kind = AccountKind.ISSUANCE))
}

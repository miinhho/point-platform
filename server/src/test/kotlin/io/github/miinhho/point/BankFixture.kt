package io.github.miinhho.point

import io.github.miinhho.point.ledger.Accounts
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeRepository
import org.springframework.stereotype.Component

/**
 * 픽스처가 은행을 만드는 유일한 자리. 창설 엔드포인트를 안 지나므로 발행 계정을 여기서 연다.
 *
 * 리포지토리로 바로 넣으면 실서버에는 없는 세상이 만들어진다 — 발행 계정 없는 포인트다.
 * 그러면 그 행을 잠그는 코드가 테스트에서만 깨지고, 진짜 결함과 낡은 픽스처가 같은 색으로 온다.
 */
@Component
class BankFixture(
    private val pointTypeRepository: PointTypeRepository,
    private val accounts: Accounts,
) {
    fun open(pointType: PointType): PointType =
        pointTypeRepository.saveAndFlush(pointType).also(accounts::openIssuance)
}

package io.github.miinhho.point.transfer

import io.github.miinhho.point.domain.balance.Balance
import io.github.miinhho.point.domain.balance.BalanceId
import io.github.miinhho.point.domain.balance.BalanceRepository
import io.github.miinhho.point.domain.pointtype.PointTypeRepository
import io.github.miinhho.point.domain.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * 잔액 0 행을 만든다. 이 포인트를 처음 받는 사용자는 행 자체가 없어 잠글 대상이 없다.
 *
 * 바깥 트랜잭션과 분리하는 이유가 둘이다. 중복키가 나도 진행 중인 이체를 rollback-only 로
 * 오염시키지 않고, 삽입 락을 즉시 커밋해 이체가 잡는 X 락과 겹치지 않는다.
 *
 * 중복키를 여기서 잡지 않는다 — 이 트랜잭션은 그 시점에 이미 rollback-only 라 잡아 봐야
 * 커밋에서 UnexpectedRollbackException 이 난다. 판정은 호출부가 트랜잭션 밖에서 한다.
 */
@Service
class BalanceInitializer(
    private val balanceRepository: BalanceRepository,
    private val userRepository: UserRepository,
    private val pointTypeRepository: PointTypeRepository,
) {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun create(userId: Long, pointTypeId: Long) {
        balanceRepository.saveAndFlush(
            Balance(
                user = userRepository.getReferenceById(userId),
                pointType = pointTypeRepository.getReferenceById(pointTypeId),
                amount = 0,
            ),
        )
    }

    fun exists(userId: Long, pointTypeId: Long) = balanceRepository.existsById(BalanceId(userId, pointTypeId))
}

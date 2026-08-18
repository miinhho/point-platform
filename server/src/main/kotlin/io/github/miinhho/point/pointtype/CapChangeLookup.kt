package io.github.miinhho.point.pointtype

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * 멱등성 키로 이미 기록된 변경을 찾는다. **새 트랜잭션에서 읽는다.**
 *
 * REPEATABLE READ 에서는 진행 중인 트랜잭션의 스냅샷이 시작 시점에 고정돼, 경쟁에서
 * 이긴 요청이 방금 커밋한 행이 보이지 않는다. 그러면 같은 키로 온 재요청이 "이미
 * 기록됨"을 못 보고 검증으로 떨어진다.
 */
@Service
class CapChangeLookup(private val capChangeRepository: CapChangeRepository) {
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    fun freshFindByIdempotencyKey(actorId: Long, key: String): CapChange? =
        capChangeRepository.findByByIdAndIdempotencyKey(actorId, key)
}

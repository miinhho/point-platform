package io.github.miinhho.point.pointtype

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

/**
 * 상한 변경 이력. **읽는 화면이 없다** — 내역에 오르지 않고 지금 상한은 은행 페이지가 준다.
 *
 * 그래도 남긴다. 되돌릴 수 없는 결정이라 이슈가 났을 때 「누가 언제 무엇을 무엇으로 바꿨나」에
 * 답할 데가 있어야 하고, 그 답은 사람이 직접 본다. 멱등 재요청만 여기서 조회한다.
 */
interface CapChangeRepository : JpaRepository<CapChange, Long> {
    // 키는 요청자와 함께 찾는다 — 키만으로 찾는 길을 두면 남의 것을 물을 수 있다.
    @Query("select c from CapChange c where c.journalEntry.requesterId = :requesterId and c.journalEntry.idempotencyKey = :key")
    fun findByRequesterAndKey(requesterId: Long, key: String): CapChange?
}

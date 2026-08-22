package io.github.miinhho.point.ledger

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 원장이 스스로를 검사하고, 틀렸으면 전기에서 다시 만든다.
 *
 * 「잔액이 틀렸는지 알 방법이 없다」를 닫는 자리다 — 잔액은 전기의 합을 접어 둔 것이므로
 * 원본에서 다시 접을 수 있다. 정정도 삭제가 아니라 재계산이다.
 */
@Service
class LedgerAudit(
    private val accountRepository: AccountRepository,
    private val postingRepository: PostingRepository,
) {
    /**
     * 깨진 것들. 빈 목록이면 원장이 스스로와 맞는다.
     *
     * 「발행 계정 없는 포인트」는 여기서 묻지 않는다 — 그것은 포인트가 제대로 났는가이지
     * 원장이 스스로와 맞는가가 아니고, 만드는 길이 하나뿐이라 그 위에서 이미 막혀 있다.
     */
    @Transactional(readOnly = true)
    fun check(): List<String> = buildList {
        postingRepository.entriesOutOfBalance().forEach { add("사건 ${it[0]} 의 전기 합이 ${it[1]} 이다") }
        postingRepository.pointTypesOutOfBalance().forEach { add("포인트 ${it[0]} 의 전기 합이 ${it[1]} 이다") }
        addAll(drifted().map { (account, sum) -> "계정 ${account.id} 의 잔액 ${account.balance} ≠ 전기 합 $sum" })
    }

    /** 잔액을 전기에서 다시 접는다. 고친 계정 수를 준다. */
    @Transactional
    fun recompute(): Int = drifted().onEach { (account, sum) -> account.balance = sum }.size

    private fun drifted(): List<Pair<Account, Long>> {
        val sums = postingRepository.sumsByAccount().associate { it[0] as Long to it[1] as Long }
        return accountRepository.findAll()
            .map { it to (sums[it.id] ?: 0L) }
            .filter { (account, sum) -> account.balance != sum }
    }
}

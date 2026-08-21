package io.github.miinhho.point.ledger

import io.github.miinhho.point.pointtype.PointTypeRepository
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
    private val pointTypeRepository: PointTypeRepository,
) {
    /** 깨진 것들. 빈 목록이면 원장이 스스로와 맞는다. */
    @Transactional(readOnly = true)
    fun check(): List<String> = buildList {
        postingRepository.entriesOutOfBalance().forEach { add("사건 ${it[0]} 의 전기 합이 ${it[1]} 이다") }
        postingRepository.pointTypesOutOfBalance().forEach { add("포인트 ${it[0]} 의 전기 합이 ${it[1]} 이다") }
        addAll(driftedAccounts().map { (account, sum) -> "계정 ${account.id} 의 잔액 ${account.balance} ≠ 전기 합 $sum" })

        val withIssuance = accountRepository.findAll().filter { it.kind == AccountKind.ISSUANCE }.map { it.pointTypeId }.toSet()
        pointTypeRepository.findAll().mapNotNull { it.id }.filterNot { it in withIssuance }
            .forEach { add("포인트 $it 에 발행 계정이 없다") }
    }

    /** 잔액을 전기에서 다시 접는다. 고친 계정 수를 준다. */
    @Transactional
    fun recompute(): Int = driftedAccounts().onEach { (account, sum) -> account.balance = sum }.size

    private fun driftedAccounts(): List<Pair<Account, Long>> {
        val sums = postingRepository.sumsByAccount().associate { it[0] as Long to it[1] as Long }
        return accountRepository.findAll()
            .map { it to (sums[it.id] ?: 0L) }
            .filter { (account, sum) -> account.balance != sum }
    }
}

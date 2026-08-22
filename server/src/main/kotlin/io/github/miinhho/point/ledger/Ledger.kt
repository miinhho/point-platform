package io.github.miinhho.point.ledger

import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * 잔액을 바꾸는 유일한 길. **규칙은 [Draft] 와 [Supply] 에 있고 여기는 그것을 표에 옮긴다** —
 * 사건을 적고, 순서대로 잔액을 접고, 전기를 남긴다. 근거: docs/LEDGER.md.
 *
 * 이 클래스가 아는 것은 순서와 트랜잭션뿐이다. 합이 0 인지 · 누구를 먼저 잠글지는 여기서
 * 판단하지 않으므로, 새 사건 종류가 생겨도 그 규칙을 다시 쓰지 않는다.
 */
@Service
class Ledger(
    private val journalEntryRepository: JournalEntryRepository,
    private val postingRepository: PostingRepository,
    private val accountRepository: AccountRepository,
    private val metrics: LedgerMetrics,
) {
    class Issued(val entry: JournalEntry, val totalIssuedAfter: Long, val issueCapAt: Long)

    class Capped(val entry: JournalEntry, val supply: Supply)

    /** 발행. 상한은 공급을 잠근 쪽만이 안다. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun issue(requesterId: Long, idempotencyKey: String, pointTypeId: Long, amount: Long): Issued {
        val supply = lockSupply(pointTypeId)
        // 사건이 첫 쓰기다. 상한 검사보다도 먼저여야 한다 — 뒤에 두면 같은 키의 경쟁에서
        // 진 쪽이 이긴 쪽이 쓴 여유에 걸려 「상한을 넘었다」를 받는다. 그는 다시 눌렀을 뿐이다.
        val entry = open(JournalKind.ISSUE, requesterId, idempotencyKey, pointTypeId)
        if (!supply.allows(amount)) throw DomainFailureException(FailureCode.CAP_EXCEEDED, "발행 상한 초과")

        apply(entry, Draft.issue(issuerKey = requesterId, amount = amount))
        return Issued(entry, totalIssuedAfter = supply.issued + amount, issueCapAt = supply.cap)
    }

    @Transactional(propagation = Propagation.MANDATORY)
    fun transfer(requesterId: Long, idempotencyKey: String, pointTypeId: Long, fromId: Long, toId: Long, amount: Long): JournalEntry =
        move(JournalKind.TRANSFER, requesterId, idempotencyKey, pointTypeId, fromId, toId, amount)

    /**
     * 구매. 원장에서는 이체와 같은 줄이고 종류만 다르다 — 산 사람 −N · 은행장 +N 이라
     * **유통량을 줄이지 않는다.** 무엇을 샀는지는 원장 밖의 기록이다 (docs/LEDGER.md 6 단계).
     *
     * [checked] 는 사건을 적은 **뒤에** 돈다. 파는 쪽의 판정(재고·1 인 한도)을 앞에 두면
     * 같은 키의 경쟁에서 진 쪽이 이긴 쪽이 쓴 마지막 하나에 걸려 「재고가 부족해요」를 받는다 —
     * 그는 다시 눌렀을 뿐이고, 돈은 이미 나갔다. [issue] 의 상한이 같은 자리다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    fun purchase(
        requesterId: Long,
        idempotencyKey: String,
        pointTypeId: Long,
        buyerId: Long,
        issuerId: Long,
        amount: Long,
        checked: () -> Unit,
    ): JournalEntry {
        val entry = open(JournalKind.PURCHASE, requesterId, idempotencyKey, pointTypeId)
        checked()
        apply(entry, Draft.transfer(fromKey = buyerId, toKey = issuerId, amount = amount))
        return entry
    }

    private fun move(kind: JournalKind, requesterId: Long, idempotencyKey: String, pointTypeId: Long, fromId: Long, toId: Long, amount: Long): JournalEntry {
        val entry = open(kind, requesterId, idempotencyKey, pointTypeId)
        apply(entry, Draft.transfer(fromKey = fromId, toKey = toId, amount = amount))
        return entry
    }

    /**
     * 상한 변경. 공급을 잠그는 이유는 「이미 발행한 양보다 낮출 수 없다」를 보는 동안 발행이
     * 끼어들지 못하게 하는 것이고, 그래서 발행과 같은 행이다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    fun changeCap(requesterId: Long, idempotencyKey: String, pointTypeId: Long): Capped {
        val supply = lockSupply(pointTypeId)
        val entry = open(JournalKind.CAP_CHANGE, requesterId, idempotencyKey, pointTypeId)
        apply(entry, Draft.capChange())
        return Capped(entry, supply)
    }

    /**
     * 공급을 잠그고 지금 값을 준다. 발행 계정 행이 그 포인트의 뮤텍스다.
     *
     * 잠금 읽기라 현재 값을 본다 — 일반 읽기는 REPEATABLE READ 스냅샷이라, 잠그기 전에
     * 커밋된 상한 변경이 안 보여 낡은 상한으로 발행이 통과한다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    fun lockSupply(pointTypeId: Long): Supply {
        val row = accountRepository.lockIssuance(pointTypeId).firstOrNull() ?: error("발행 계정이 없다: $pointTypeId")
        return Supply(issued = -(row[0] as Long), cap = row[1] as Long)
    }

    /** 상한을 바꾼다. [lockSupply] 로 공급을 쥔 아래에서만 부른다. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun setCap(pointTypeId: Long, newCap: Long) {
        check(accountRepository.setIssueCap(pointTypeId, newCap) == 1) { "발행 계정이 없다: $pointTypeId" }
    }

    /**
     * 사건안을 표에 옮긴다. [Draft.ordered] 가 정한 순서대로 잔액을 접고 나서 전기를 남긴다.
     *
     * 차감이 실패하면 예외가 트랜잭션을 되돌리므로 먼저 더한 것도 함께 사라진다.
     */
    private fun apply(entry: JournalEntry, draft: Draft) {
        val pointTypeId = entry.pointTypeId
        draft.ordered.forEach { line -> settle(pointTypeId, line) }
        draft.lines.forEach { line -> post(entry, line) }
        metrics.applied(entry.kind, draft.lines.size)
    }

    private fun settle(pointTypeId: Long, line: Draft.Line) {
        when {
            line.holderKey == Draft.ISSUANCE ->
                check(accountRepository.debitIssuance(pointTypeId, -line.amount) == 1) { "발행 계정이 없다: $pointTypeId" }
            // 영향 행 0 은 조건(balance >= amount)이 거짓이었다는 뜻이다. 행이 없는 것도 잔액 0 이라 같은 답이다.
            line.amount < 0 -> if (accountRepository.debitHolder(pointTypeId, line.holderKey, -line.amount) == 0) {
                throw DomainFailureException(FailureCode.INSUFFICIENT_BALANCE, "잔액 부족")
            }
            // upsert 는 새로 넣으면 1, 더하면 2 다. 0 이면 아무 행도 안 바뀐 것이고 그러면
            // 전기만 남아 잔액과 갈린다 — 여기서 터뜨리지 않으면 그 사실을 아무도 모른다.
            else -> check(accountRepository.creditHolder(pointTypeId, line.holderKey, line.amount) > 0) {
                "입금이 아무 행도 바꾸지 않았다: $pointTypeId/${line.holderKey}"
            }
        }
    }

    // saveAndFlush — unique 위반이 여기서 난다. 커밋까지 미루면 어느 문장이 깨졌는지 알 수 없다.
    private fun open(kind: JournalKind, requesterId: Long, idempotencyKey: String, pointTypeId: Long): JournalEntry =
        journalEntryRepository.saveAndFlush(
            JournalEntry(
                kind = kind,
                requesterId = requesterId,
                idempotencyKey = idempotencyKey,
                pointTypeId = pointTypeId,
            ),
        )

    private fun post(entry: JournalEntry, line: Draft.Line) {
        val accountId = accountRepository.idOf(entry.pointTypeId, line.holderKey)
            ?: error("전기할 계정이 없다: ${line.holderKey}")
        postingRepository.saveAndFlush(
            Posting(
                journalEntry = entry,
                account = accountRepository.getReferenceById(accountId),
                pointTypeId = entry.pointTypeId,
                amount = line.amount,
            ),
        )
    }
}

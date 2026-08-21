package io.github.miinhho.point.ledger

import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.shared.DomainFailureException
import io.github.miinhho.point.shared.FailureCode
import io.github.miinhho.point.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * 잔액을 바꾸는 유일한 길. 사건을 적고 전기를 남기고 잔액을 접는다 — 근거: docs/LEDGER.md.
 *
 * 락 순서는 여기 한 곳에만 있다: 발행 계정 → 보유자 계정(사용자 id 오름차순).
 * 발행은 공급 뮤텍스를 먼저 쥐고 사건을 적는다 — 사건 행의 FK 가 `point_types` 에 S 락을
 * 잡는데, 상한 변경이 같은 뮤텍스 아래에서 그 행을 X 로 고치므로 순서가 반대면 교착이다.
 */
@Service
class Ledger(
    private val journalEntryRepository: JournalEntryRepository,
    private val postingRepository: PostingRepository,
    private val accountRepository: AccountRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val userRepository: UserRepository,
) {
    class Issued(val entry: JournalEntry, val totalIssuedAfter: Long, val issueCapAt: Long)

    class Capped(val entry: JournalEntry, val totalIssued: Long)

    /** 발행. 상한은 여기서 본다 — 공급을 잠근 쪽만이 여유를 안다. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun issue(requesterId: Long, idempotencyKey: String, pointTypeId: Long, amount: Long): Issued {
        val issued = lockSupply(pointTypeId)
        // 사건이 첫 쓰기다. 상한 검사보다도 먼저여야 한다 — 뒤에 두면 같은 키의 경쟁에서
        // 진 쪽이 이긴 쪽이 쓴 여유에 걸려 「상한을 넘었다」를 받는다. 그는 다시 눌렀을 뿐이다.
        val entry = open(JournalKind.ISSUE, requesterId, idempotencyKey, pointTypeId)
        val cap = issueCapOf(pointTypeId)
        if (issued + amount > cap) throw DomainFailureException(FailureCode.CAP_EXCEEDED, "발행 상한 초과")
        check(accountRepository.debitIssuance(pointTypeId, amount) == 1) { "발행 계정이 없다: $pointTypeId" }
        accountRepository.creditHolder(pointTypeId, requesterId, amount)
        post(entry, ISSUANCE_HOLDER_KEY, -amount)
        post(entry, requesterId, amount)
        return Issued(entry, totalIssuedAfter = issued + amount, issueCapAt = cap)
    }

    @Transactional(propagation = Propagation.MANDATORY)
    fun transfer(requesterId: Long, idempotencyKey: String, pointTypeId: Long, fromId: Long, toId: Long, amount: Long): JournalEntry {
        val entry = open(JournalKind.TRANSFER, requesterId, idempotencyKey, pointTypeId)
        // 오름차순으로 건드린다 — A→B 와 B→A 가 겹칠 때 순서가 어긋나면 교착이다.
        // 차감이 실패하면 예외가 트랜잭션을 되돌리므로 먼저 더한 것도 함께 사라진다.
        for (userId in listOf(fromId, toId).sorted()) {
            if (userId == fromId) debitHolderOrFail(pointTypeId, fromId, amount) else accountRepository.creditHolder(pointTypeId, toId, amount)
        }
        post(entry, fromId, -amount)
        post(entry, toId, amount)
        return entry
    }

    /**
     * 상한 변경. 전기가 없다 — 잔액은 안 움직인다. 공급을 잠그는 이유는 「이미 발행한 양보다
     * 낮출 수 없다」를 보는 동안 발행이 끼어들지 못하게 하는 것이고, 그래서 발행과 같은 행이다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    fun changeCap(requesterId: Long, idempotencyKey: String, pointTypeId: Long): Capped {
        val issued = lockSupply(pointTypeId)
        return Capped(open(JournalKind.CAP_CHANGE, requesterId, idempotencyKey, pointTypeId), issued)
    }

    /** 공급을 잠그고 지금까지 발행된 양을 준다. 상한 변경이 발행과 같은 행을 잠그는 길이다. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun lockSupply(pointTypeId: Long): Long =
        -(accountRepository.lockIssuance(pointTypeId) ?: error("발행 계정이 없다: $pointTypeId"))

    private fun issueCapOf(pointTypeId: Long): Long =
        pointTypeRepository.lockIssueCap(pointTypeId) ?: throw DomainFailureException(FailureCode.POINT_TYPE_NOT_FOUND, "포인트 없음")

    // saveAndFlush — unique 위반이 여기서 난다. 커밋까지 미루면 어느 문장이 깨졌는지 알 수 없다.
    private fun open(kind: JournalKind, requesterId: Long, idempotencyKey: String, pointTypeId: Long): JournalEntry =
        journalEntryRepository.saveAndFlush(
            JournalEntry(
                kind = kind,
                requester = userRepository.getReferenceById(requesterId),
                idempotencyKey = idempotencyKey,
                pointType = pointTypeRepository.getReferenceById(pointTypeId),
            ),
        )

    private fun debitHolderOrFail(pointTypeId: Long, userId: Long, amount: Long) {
        if (accountRepository.debitHolder(pointTypeId, userId, amount) == 0) {
            throw DomainFailureException(FailureCode.INSUFFICIENT_BALANCE, "잔액 부족")
        }
    }

    private fun post(entry: JournalEntry, holderKey: Long, amount: Long) {
        val accountId = accountRepository.idOf(entry.pointType.id!!, holderKey) ?: error("전기할 계정이 없다: $holderKey")
        postingRepository.saveAndFlush(
            Posting(
                journalEntry = entry,
                account = accountRepository.getReferenceById(accountId),
                pointType = entry.pointType,
                amount = amount,
            ),
        )
    }

    private companion object {
        // accounts.holder_key 가 발행 계정에 접어 두는 값 (V1__baseline.sql).
        const val ISSUANCE_HOLDER_KEY = 0L
    }
}

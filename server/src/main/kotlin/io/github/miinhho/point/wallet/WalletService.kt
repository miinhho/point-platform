package io.github.miinhho.point.wallet

import io.github.miinhho.point.ledger.AccountRepository
import io.github.miinhho.point.pointtype.BankAccess
import io.github.miinhho.point.pointtype.Relation
import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointTypeResponses
import io.github.miinhho.point.pointtype.PointVisibility
import io.github.miinhho.point.transfer.TransferRepository
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.user.toResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WalletService(
    private val userRepository: UserRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val accountRepository: AccountRepository,
    private val pointTypeResponses: PointTypeResponses,
    private val bankAccess: BankAccess,
    private val transferRepository: TransferRepository,
) {
    @Transactional(readOnly = true)
    fun me(userId: Long) = requireUser(userId).toResponse(userRepository.sharedNames())

    // 담는 기준은 잔액이 아니라 관계다 — 초대를 수락한 사람은 아직 아무것도 못 받았어도
    // 그 은행의 회원이다. 안 담으면 가입은 됐는데 그 은행이 어느 화면에도 없다
    // (홈에 카드가 없고, 초대함은 수락으로 비었고, 내역에는 아직 아무 일도 없다).
    // 근거: docs/API.md 「아직 계약이 아닌 것」.
    @Transactional(readOnly = true)
    fun wallet(userId: Long): WalletResponse {
        val user = requireUser(userId)
        val amountByType = accountRepository.findByUserId(userId).associate { it.pointType.id to it.balance }
        val relations = bankAccess.relationsOf(userId)
        val myMemberships = bankAccess.memberOf(userId)
        // 관계가 있는 것만 읽는다 — 전부 읽어 메모리에서 거르면 은행이 늘수록 무거워진다.
        val held = pointTypeRepository.findAllById(relations.ids(CARRIES)).filter { relations.any(it, CARRIES) }
        // id 로 맞춘다 — 순서로 맞추면 응답 조립이 하나를 거르는 날 잔액 카드가 조용히 사라진다.
        val responses = pointTypeResponses.of(held, userId).associateBy { it.id }
        val spent = transferRepository.spentPointTypeIdsOf(userId)
        val balances = held.map { pointType ->
            val amount = amountByType[pointType.id] ?: 0
            // 나온 사람의 잔액은 남지만 쓸 수 없다 — 화면이 묻기 전에 답이 실려 있어야 한다.
            val locked = pointType.visibility == PointVisibility.PRIVATE && pointType.id !in myMemberships
            BalanceResponse(
                pointType = responses.getValue(pointType.publicId.toString()),
                amount = amount,
                neverSpent = pointType.id !in spent,
                sendable = if (locked) 0 else amount,
            )
        }
        return WalletResponse(user.toResponse(userRepository.sharedNames()), balances)
    }

    companion object {
        /**
         * 지갑이 카드를 담아 주는 관계. **[BankAccess.REACHES] 안에 있어야 한다** — 담기는데
         * 못 닿으면 카드는 있고 페이지는 없다. 반대는 열려 있다(초대만 받은 사람은 닿지만
         * 안 담긴다). 근거: docs/API.md.
         */
        val CARRIES: Set<Relation> = setOf(Relation.HOLDS_BALANCE, Relation.ISSUER, Relation.MEMBER)
    }

    private fun requireUser(userId: Long) =
        userRepository.findById(userId).orElseThrow { IllegalStateException("인증된 사용자를 찾을 수 없다") }
}

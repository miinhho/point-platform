package io.github.miinhho.point.wallet

import io.github.miinhho.point.pointtype.PointTypeRepository
import io.github.miinhho.point.pointtype.PointTypeResponses
import io.github.miinhho.point.user.UserRepository
import io.github.miinhho.point.user.toResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WalletService(
    private val userRepository: UserRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val balanceRepository: BalanceRepository,
    private val pointTypeResponses: PointTypeResponses,
) {
    @Transactional(readOnly = true)
    fun me(userId: Long) = requireUser(userId).toResponse(userRepository.sharedNames())

    // 근거: docs/API.md — 잔액 0 이라도 내가 발행자인 포인트는 포함한다.
    @Transactional(readOnly = true)
    fun wallet(userId: Long): WalletResponse {
        val user = requireUser(userId)
        val amountByType = balanceRepository.findByUserId(userId).associate { it.id.pointTypeId to it.amount }
        val held = pointTypeRepository.findAll().filter { pointType ->
            (amountByType[pointType.id] ?: 0) > 0 || pointType.issuer.id == userId
        }
        // id 로 맞춘다 — 순서로 맞추면 응답 조립이 하나를 거르는 날 잔액 카드가 조용히 사라진다.
        val responses = pointTypeResponses.of(held, userId).associateBy { it.id }
        val balances = held.map { pointType ->
            val amount = amountByType[pointType.id] ?: 0
            BalanceResponse(responses.getValue(pointType.publicId.toString()), amount, sendable = amount)
        }
        return WalletResponse(user.toResponse(userRepository.sharedNames()), balances)
    }

    private fun requireUser(userId: Long) =
        userRepository.findById(userId).orElseThrow { IllegalStateException("인증된 사용자를 찾을 수 없다") }
}

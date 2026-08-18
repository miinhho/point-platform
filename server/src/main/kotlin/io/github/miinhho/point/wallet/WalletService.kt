package io.github.miinhho.point.wallet

import io.github.miinhho.point.api.toResponse
import io.github.miinhho.point.domain.balance.BalanceRepository
import io.github.miinhho.point.domain.pointtype.PointTypeRepository
import io.github.miinhho.point.domain.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WalletService(
    private val userRepository: UserRepository,
    private val pointTypeRepository: PointTypeRepository,
    private val balanceRepository: BalanceRepository,
) {
    @Transactional(readOnly = true)
    fun me(userId: Long) = requireUser(userId).toResponse(userRepository.sharedNames())

    // 근거: docs/API.md — 잔액 0 이라도 내가 발행자인 포인트는 포함한다.
    @Transactional(readOnly = true)
    fun wallet(userId: Long): WalletResponse {
        val user = requireUser(userId)
        // 이름 겹침은 한 번만 집계한다 — 포인트마다 세면 N+1 이다.
        val sharedPointNames = pointTypeRepository.sharedNames()
        val balanceByType = balanceRepository.findByUserId(userId).associateBy { it.pointType.id }
        val balances = pointTypeRepository.findAll().mapNotNull { pointType ->
            val amount = balanceByType[pointType.id]?.amount ?: 0
            if (amount <= 0 && pointType.issuer.id != userId) return@mapNotNull null
            BalanceResponse(pointType.toResponse(userId, sharedPointNames), amount, sendable = amount)
        }
        return WalletResponse(user.toResponse(userRepository.sharedNames()), balances)
    }

    @Transactional(readOnly = true)
    fun pointTypes(userId: Long): List<PointTypeResponse> {
        val sharedPointNames = pointTypeRepository.sharedNames()
        return pointTypeRepository.findAll().map { it.toResponse(userId, sharedPointNames) }
    }

    private fun requireUser(userId: Long) =
        userRepository.findById(userId).orElseThrow { IllegalStateException("인증된 사용자를 찾을 수 없다") }
}

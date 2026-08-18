package io.github.miinhho.point.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

interface RefreshTokenRepository : JpaRepository<RefreshToken, Long> {
    fun findByTokenHash(tokenHash: String): RefreshToken?

    // 독립 트랜잭션으로 즉시 커밋한다 — 재사용 탐지는 호출부(rotate)가 이어서 예외를 던지고
    // 그 예외가 바깥 트랜잭션을 롤백시키는데, 같은 트랜잭션이면 이 revoke 마저 함께 취소된다.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.familyId = :familyId and t.revokedAt is null")
    fun revokeFamily(familyId: UUID, now: Instant): Int

    // 조건부 UPDATE 로 회전을 원자화한다 — 읽고 나서 쓰면 동시 요청 둘 다 revokedAt==null 을
    // 보고 통과해 같은 토큰에서 유효한 토큰이 두 벌 나갈 수 있다. 영향 행 0 은 레이스 패배다.
    @Modifying
    @Query(
        "update RefreshToken t set t.revokedAt = :now, t.replacedByHash = :nextHash " +
            "where t.tokenHash = :tokenHash and t.revokedAt is null",
    )
    fun markRotated(tokenHash: String, nextHash: String, now: Instant): Int
}

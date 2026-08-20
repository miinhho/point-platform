package io.github.miinhho.point.auth

import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import java.util.UUID

/** 핸들이 있든 없든 같은 비용의 해시를 한 번 돌린다 — 응답 시간이 존재 여부를 말하지 않게. */
@Component
class PasswordCheck(private val passwordEncoder: PasswordEncoder) {
    /**
     * 없는 핸들에 돌릴 해시. 상수로 박지 않고 인코더가 만들게 한다 — 박아 두면 인코더의
     * cost 가 바뀔 때 조용히 갈리고, 실제로 12 대 10 으로 갈려 응답이 3.7 배 느렸다.
     */
    val absentHandleHash: String = passwordEncoder.encode(UUID.randomUUID().toString())!!

    fun matches(password: String, hash: String?): Boolean =
        passwordEncoder.matches(password, hash ?: absentHandleHash)
}

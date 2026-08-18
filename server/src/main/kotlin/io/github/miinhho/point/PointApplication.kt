package io.github.miinhho.point

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration
import org.springframework.boot.runApplication

// UserDetailsService 없이 JWT 로만 인증한다 — 자동 생성 계정을 막는다.
@SpringBootApplication(exclude = [UserDetailsServiceAutoConfiguration::class])
class PointApplication

fun main(args: Array<String>) {
	runApplication<PointApplication>(*args)
}

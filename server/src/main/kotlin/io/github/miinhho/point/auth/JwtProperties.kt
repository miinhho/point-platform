package io.github.miinhho.point.auth

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties("point.jwt")
data class JwtProperties(
    val secret: String,
    val accessTtl: Duration,
    val refreshTtl: Duration,
)

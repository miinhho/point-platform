package io.github.miinhho.point.auth

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.security.autoconfigure.actuate.web.servlet.EndpointRequest
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(JwtProperties::class)
class SecurityConfig(private val jwtService: JwtService) {
    /**
     * 관리 포트는 별도 체인이다. 지표를 8080 에 열면 누구나 원장이 얼마나 틀어졌는지를 보고,
     * 인증을 걸면 Prometheus 가 못 긁는다 — 포트를 나누고 그 포트를 앞단에서 막는다.
     */
    @Bean
    @Order(1)
    fun managementChain(http: HttpSecurity): SecurityFilterChain =
        http.securityMatcher(EndpointRequest.toAnyEndpoint())
            .authorizeHttpRequests { it.anyRequest().permitAll() }
            .csrf { it.disable() }
            .build()

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers("/api/auth/**", "/actuator/health").permitAll()
                it.anyRequest().authenticated()
            }
            // 본문을 { "code": "UNAUTHENTICATED" } 로 맞춘다 — 프론트가 code 로 분기한다.
            .exceptionHandling { it.authenticationEntryPoint(unauthenticatedEntryPoint()) }
            // @Component 로 두면 Boot 가 서블릿 필터로도 자동 등록해 SecurityContextHolderFilter 보다
            // 먼저 실행되고, 그 필터가 컨텍스트를 초기화하면서 여기서 세운 인증이 지워진다.
            .addFilterBefore(JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter::class.java)
        return http.build()
    }

    private fun unauthenticatedEntryPoint() = AuthenticationEntryPoint { _, response, _ ->
        response.status = HttpStatus.UNAUTHORIZED.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.writer.write("""{"code":"UNAUTHENTICATED","outcome":"none"}""")
    }
}

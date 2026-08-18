package io.github.miinhho.point.auth

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
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
        response.writer.write("""{"code":"UNAUTHENTICATED"}""")
    }
}

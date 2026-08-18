package io.github.miinhho.point.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter

// principal 은 User 가 아니라 내부 id(Long) 다 — UserDetailsService 없이 토큰만으로 인증한다.
// @Component 로 두지 않는다 — SecurityConfig 가 직접 생성해 체인에 넣는다 (자동 필터 등록 회피).
class JwtAuthenticationFilter(private val jwtService: JwtService) : OncePerRequestFilter() {
    // 핸들러가 없는 요청은 /error 로 내부 forward 되는데, 기본값(true)이면 그 재실행에서
    // 인증이 비어 원래 404 였을 응답이 401 로 바뀐다.
    override fun shouldNotFilterErrorDispatch(): Boolean = false

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val header = request.getHeader(HttpHeaders.AUTHORIZATION)
        val token = header?.takeIf { it.startsWith("Bearer ") }?.removePrefix("Bearer ")
        val userId = token?.let(jwtService::parseUserId)

        if (userId != null) {
            SecurityContextHolder.getContext().authentication =
                UsernamePasswordAuthenticationToken(userId, null, emptyList())
        }
        filterChain.doFilter(request, response)
    }
}

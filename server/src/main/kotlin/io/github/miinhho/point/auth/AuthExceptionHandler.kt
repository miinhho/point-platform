package io.github.miinhho.point.auth

import io.github.miinhho.point.api.FailureCode
import io.github.miinhho.point.api.FailureResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class AuthExceptionHandler {
    @ExceptionHandler(BadCredentialsException::class)
    fun onBadCredentials(): ResponseEntity<FailureResponse> =
        ResponseEntity.status(FailureCode.BAD_CREDENTIALS.status)
            .body(FailureResponse.none(FailureCode.BAD_CREDENTIALS))

    @ExceptionHandler(InvalidRefreshTokenException::class)
    fun onInvalidRefreshToken(): ResponseEntity<FailureResponse> =
        ResponseEntity.status(FailureCode.UNAUTHENTICATED.status)
            .body(FailureResponse.none(FailureCode.UNAUTHENTICATED))
}

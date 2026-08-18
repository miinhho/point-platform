package io.github.miinhho.point.api

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class DomainExceptionHandler {
    @ExceptionHandler(DomainFailureException::class)
    fun onDomainFailure(e: DomainFailureException): ResponseEntity<FailureResponse> =
        ResponseEntity.status(e.status).body(FailureResponse(e.code, e.message))

    // 본문이 계약과 다른 모양(소수점 amount 등)이면 파싱 단계에서 던져진다 — 같은 400 으로 맞춘다.
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun onUnreadableBody(): ResponseEntity<FailureResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(FailureResponse("SERVER", "요청 형식 오류"))
}

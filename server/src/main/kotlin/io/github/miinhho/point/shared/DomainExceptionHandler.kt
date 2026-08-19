package io.github.miinhho.point.shared

import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.WebRequest
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

/**
 * 오류 본문에 **예외가 없다** (docs/API.md 「실패」).
 *
 * `code` 도 `outcome` 도 없는 본문이 새면 화면은 그것을 「결과를 알 수 없다」로 읽고,
 * 아무 일도 일어나지 않은 요청을 두고 돈이 어디 있는지 모른다고 말하게 된다.
 */
@RestControllerAdvice
class DomainExceptionHandler : ResponseEntityExceptionHandler() {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(DomainFailureException::class)
    fun onDomainFailure(e: DomainFailureException): ResponseEntity<FailureResponse> =
        // 여기 오는 것은 전부 트랜잭션이 롤백된 뒤다 — 아무것도 남지 않았다고 단정할 수 있다.
        ResponseEntity.status(e.status).body(FailureResponse.none(e.code, e.message))

    /**
     * 예상하지 못한 것. 던진 자리가 커밋 앞인지 뒤인지 서버도 모르므로 `unknown` 이다.
     *
     * `Exception` 이 아니라 `Throwable` 을 잡는다 — 클래스가 어긋나면 `NoSuchMethodError` 처럼
     * `Error` 가 오고, 그때가 본문에 `code` 도 `outcome` 도 없어 가장 읽기 어려운 순간이다.
     * 스택트레이스를 여기서 남긴다. 조언이 응답을 만들면 프레임워크는 더 이상 찍지 않는다.
     */
    @ExceptionHandler(Throwable::class)
    fun onUnexpected(e: Throwable): ResponseEntity<FailureResponse> {
        log.error("처리하지 못한 예외", e)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(FailureResponse.unknown(FailureCode.SERVER, "서버 오류"))
    }

    // 프레임워크가 상태를 아는 것들(없는 경로·안 되는 메서드·읽지 못한 본문)은 그 상태를
    // 그대로 두고 본문만 계약 모양으로 바꾼다.
    override fun handleExceptionInternal(
        ex: Exception,
        body: Any?,
        headers: HttpHeaders,
        statusCode: HttpStatusCode,
        request: WebRequest,
    ): ResponseEntity<Any>? {
        val code = when {
            statusCode.value() == HttpStatus.NOT_FOUND.value() -> FailureCode.UNKNOWN_ENDPOINT
            statusCode.is4xxClientError -> FailureCode.MALFORMED_REQUEST
            else -> FailureCode.SERVER
        }
        val failure = if (code == FailureCode.SERVER) {
            FailureResponse.unknown(code, "서버 오류")
        } else {
            FailureResponse.none(code, ex.message)
        }
        return ResponseEntity.status(statusCode).body(failure)
    }
}

package io.github.miinhho.point.shared

import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.NoHandlerFoundException
import org.springframework.web.servlet.resource.NoResourceFoundException

// 오류 응답을 한 곳에서 만든다 — 핸들러마다 흩어지면 곧 한 곳이 outcome 을 빠뜨린다.
@RestControllerAdvice
class DomainExceptionHandler {
    @ExceptionHandler(DomainFailureException::class)
    fun onDomainFailure(e: DomainFailureException): ResponseEntity<FailureResponse> =
        // 여기 오는 것은 전부 트랜잭션이 롤백된 뒤다 — 아무것도 남지 않았다고 단정할 수 있다.
        ResponseEntity.status(e.status).body(FailureResponse.none(e.code, e.message))

    // 본문이 계약과 다르면 파싱 단계에서 던져진다. 읽지도 못했으니 아무것도 하지 않았다.
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun onUnreadableBody(): ResponseEntity<FailureResponse> =
        ResponseEntity.status(FailureCode.MALFORMED_REQUEST.status)
            .body(FailureResponse.none(FailureCode.MALFORMED_REQUEST, "요청 형식 오류"))

    // 오류 본문에 예외가 없다 (docs/API.md 「실패」). 프레임워크 기본 404 본문에는
    // code 도 outcome 도 없어서 화면이 「결과를 알 수 없다」로 읽는다 — 아무 일도 없던
    // 요청을 두고 돈이 어디 있는지 모른다고 말하게 된다.
    @ExceptionHandler(
        NoResourceFoundException::class,
        NoHandlerFoundException::class,
        HttpRequestMethodNotSupportedException::class,
    )
    fun onNoHandler(): ResponseEntity<FailureResponse> =
        ResponseEntity.status(FailureCode.UNKNOWN_ENDPOINT.status)
            .body(FailureResponse.none(FailureCode.UNKNOWN_ENDPOINT, "없는 경로"))

    // 예상하지 못한 것을 여기서 삼키지 않는다. Exception 을 통째로 잡으면 프레임워크가
    // 상태를 아는 것까지 500 으로 바뀐다 — 테스트가 그것을 잡았다.
}

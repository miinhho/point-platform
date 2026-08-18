package io.github.miinhho.point.shared

import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

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

    // 예상하지 못한 것을 여기서 삼키지 않는다. Exception 을 통째로 잡으면 프레임워크가
    // 상태를 아는 것(핸들러 없는 404 등)까지 500 으로 바뀐다 — 테스트가 그것을 잡았다.
}

package io.github.miinhho.point.shared

import org.springframework.http.HttpStatus

/**
 * 계약: docs/API.md 「실패」. 코드와 상태를 한 자리에 묶는다.
 *
 * 던지는 곳마다 문자열과 상태를 각각 고르면 둘이 어긋나도 컴파일러가 잡지 못하고,
 * 클라이언트는 코드로 분기하므로 어긋난 쪽이 조용히 다른 화면을 띄운다.
 *
 * NETWORK 은 여기 없다 — 응답이 아니라 요청이 닿지 못한 것이라 서버가 만들 수 없다.
 */
enum class FailureCode(val status: HttpStatus) {
    BAD_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),
    INSUFFICIENT_BALANCE(HttpStatus.UNPROCESSABLE_ENTITY),
    CAP_EXCEEDED(HttpStatus.UNPROCESSABLE_ENTITY),
    CAP_BELOW_ISSUED(HttpStatus.UNPROCESSABLE_ENTITY),
    NOT_ISSUER(HttpStatus.FORBIDDEN),
    RECIPIENT_NOT_FOUND(HttpStatus.NOT_FOUND),
    POINT_TYPE_NOT_FOUND(HttpStatus.NOT_FOUND),
    SYMBOL_TAKEN(HttpStatus.CONFLICT),

    // 확정된 실패다. SERVER 로 보내면 프론트가 「결과를 알 수 없음」으로 읽어 거짓말이 된다.
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST),
    TRANSFER_NOT_FOUND(HttpStatus.NOT_FOUND),

    SERVER(HttpStatus.INTERNAL_SERVER_ERROR),
}

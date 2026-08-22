package io.github.miinhho.point.shared

import org.springframework.http.HttpStatus

// status 를 따로 받는 것은 SERVER 뿐이다 — 나머지는 코드가 상태를 정한다.
class DomainFailureException(
    val code: FailureCode,
    message: String,
    val status: HttpStatus = code.status,
    /** 수량을 고치라는 실패는 **고친 값을 함께 준다** — 화면이 다시 물어보지 않는다. */
    val remaining: Int? = null,
    val myRemainingLimit: Int? = null,
) : RuntimeException(message)

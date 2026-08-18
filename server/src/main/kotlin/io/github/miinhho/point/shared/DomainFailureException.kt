package io.github.miinhho.point.shared

import org.springframework.http.HttpStatus

// status 를 따로 받는 것은 SERVER 뿐이다 — 나머지는 코드가 상태를 정한다.
class DomainFailureException(
    val code: FailureCode,
    message: String,
    val status: HttpStatus = code.status,
) : RuntimeException(message)

package io.github.miinhho.point.api

import org.springframework.http.HttpStatus

// 근거: docs/API.md 「실패」. code 는 클라이언트가 FailureCode 로 그대로 파싱한다.
class DomainFailureException(val code: String, val status: HttpStatus, message: String) : RuntimeException(message)

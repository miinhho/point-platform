package io.github.miinhho.point.auth

// 계약: docs/API.md 「실패」 — 본문은 항상 { code, message? }
data class FailureResponse(val code: String, val message: String? = null)

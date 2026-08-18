package io.github.miinhho.point.domain.user

// 근거: docs/API.md 「인증」 — @minho·minho·MINHO 가 모두 같은 사람이다.
fun normalizeHandle(handle: String): String = "@" + handle.trim().replace(Regex("^@+"), "").lowercase()

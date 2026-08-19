package io.github.miinhho.point.pointtype

/** 빈 문자열은 「지운다」이고 필드가 없는 것과 다르다. */
data class ChangeDescriptionRequest(val description: String? = null)

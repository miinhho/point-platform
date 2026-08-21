package io.github.miinhho.point.issue

import io.github.miinhho.point.pointtype.PointMarkResponse
import io.github.miinhho.point.pointtype.toMark
import java.time.Instant

data class IssueResponse(
    val id: String,
    val idempotencyKey: String,
    val pointTypeId: String,
    val point: PointMarkResponse,
    /** 발행자. 받는 사람이기도 하다 — 한 사람이라 칸이 하나다. */
    val issuerId: String,
    val amount: Long,
    /** 이 발행 직후의 유통량. 지금 값이 아니다. */
    val totalIssuedAfter: Long,
    /** 그때의 상한. 나중에 바뀌어도 이 값은 안 바뀐다. */
    val issueCapAt: Long,
    val confirmedAt: Instant,
)

fun Issue.toResponse(sharedPointNames: Set<String>) = IssueResponse(
    id = publicId.toString(),
    idempotencyKey = journalEntry.idempotencyKey,
    pointTypeId = journalEntry.pointType.publicId.toString(),
    point = journalEntry.pointType.toMark(sharedPointNames),
    issuerId = journalEntry.requester.publicId.toString(),
    amount = amount,
    totalIssuedAfter = totalIssuedAfter,
    issueCapAt = issueCapAt,
    confirmedAt = journalEntry.occurredAt,
)

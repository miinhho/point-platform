package io.github.miinhho.point.shared

import com.fasterxml.jackson.annotation.JsonInclude

/**
 * 계약: docs/API.md 「실패」 — 본문은 `{ code, outcome, message? }` 다.
 *
 * `outcome` 을 코드에서 파생하지 않고 서버가 실어 준다. 클라이언트가 「이 코드는
 * unknown 인가」 표를 들고 있으면 코드를 늘릴 때마다 그 표를 함께 늘려야 하고,
 * 빠뜨리면 화면이 거짓말을 한다. SDK 를 열면 그 표를 가진 클라이언트가 우리 것만이 아니다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class FailureResponse(
    val code: String,
    val outcome: String,
    val message: String? = null,
    /** `OUT_OF_STOCK` 이 싣는 고친 값. 화면이 다시 물어보지 않고 수량을 고칠 수 있다. */
    val remaining: Int? = null,
    /** `PURCHASE_LIMIT_EXCEEDED` 가 싣는 고친 값. */
    val myRemainingLimit: Int? = null,
) {
    companion object {
        /** 서버가 아무것도 하지 않았다. 확정된 사실이다 — 롤백된 트랜잭션도 여기다. */
        fun none(code: FailureCode, message: String? = null) = FailureResponse(code.name, "none", message)

        /** 서버도 처리 여부를 모른다. 드물다. */
        fun unknown(code: FailureCode, message: String? = null) = FailureResponse(code.name, "unknown", message)
    }
}

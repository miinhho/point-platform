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

    // 받는 쪽의 RECIPIENT_NOT_FOUND 를 재사용하지 않는다 — 보내는 사람은 자기가 나온 것을
    // 이미 알고, 「대상이 없어요」는 받는 사람 핸들을 다시 확인하게 만든다.
    NOT_MEMBER(HttpStatus.FORBIDDEN),

    // 은행장이 나가면 발행할 사람이 없는 은행이 되고 상한도 품목도 관리할 수 없어진다.
    ISSUER_CANNOT_LEAVE(HttpStatus.CONFLICT),

    // 초대는 은행장의 행동이라 「내가 방금 초대했다」가 사실이 아니면 그렇게 말해야 한다.
    ALREADY_MEMBER(HttpStatus.CONFLICT),

    // 초대가 없는 것과 남의 초대를 수락하는 것이 같은 답이다 — 다르면 누가 초대됐는지가 샌다.
    INVITE_NOT_FOUND(HttpStatus.NOT_FOUND),

    // 빈 배열도 NOT_MEMBER 도 아니다 — 앞은 「회원이 0명」으로, 뒤는 「가입하면 된다」로
    // 읽힌다. 공개 은행에 명부가 없는 것은 비어 있는 것이 아니라 개념이 없는 것이다.
    NOT_A_PRIVATE_BANK(HttpStatus.NOT_FOUND),

    // 본문은 멀쩡하고 경로가 없다. MALFORMED_REQUEST 로 답하면 화면이 「입력을 고쳐 보라」고
    // 말하는데 고칠 입력이 없다.
    UNKNOWN_ENDPOINT(HttpStatus.NOT_FOUND),
    RECIPIENT_NOT_FOUND(HttpStatus.NOT_FOUND),
    POINT_TYPE_NOT_FOUND(HttpStatus.NOT_FOUND),

    // 확정된 실패다. SERVER 로 보내면 프론트가 「결과를 알 수 없음」으로 읽어 거짓말이 된다.
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST),
    TRANSFER_NOT_FOUND(HttpStatus.NOT_FOUND),

    SERVER(HttpStatus.INTERNAL_SERVER_ERROR),
}

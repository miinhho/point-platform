/**
 * 회원 자격 — 회원 · 초대 · 도달성. 포인트 모듈 안에 있되 파일은 갈라 둔다.
 *
 * <p>도달성은 공개 여부(포인트)와 회원·초대와 잔액(원장)을 함께 읽으므로 포인트와 떼어
 * 놓을 수 없다. 최상위로 빼면 둘이 서로를 참조해 순환이 되고, 그 순환은 이름을 바꿔도
 * 사라지지 않는다 — 원래 한 개념이기 때문이다.
 *
 * <p>이름을 붙여 공개면으로 선언한다. 밖에서 쓰는 것이 무엇인지가 여기 적혀 있어야
 * 「그냥 다 열려 있다」가 되지 않는다.
 */
@org.springframework.modulith.NamedInterface("membership")
package io.github.miinhho.point.pointtype.membership;

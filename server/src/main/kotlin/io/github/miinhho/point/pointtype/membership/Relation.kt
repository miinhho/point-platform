package io.github.miinhho.point.pointtype.membership

/**
 * 사람과 은행 사이에 있을 수 있는 관계. **무엇이 무엇을 열어 주는지는 이 값들의 집합이
 * 정한다** — 은행 페이지에 닿는 것은 [BankAccess.REACHES], 지갑에 담기는 것은
 * `WalletService.CARRIES` 다.
 *
 * 두 목록을 각자 조건문으로 적으면 한쪽에 항목을 더할 때 다른 쪽을 안 보게 된다. 실제로
 * 지갑에 「회원」이 더해졌을 때 도달성에 이미 회원이 있어 우연히 성립했다.
 *
 * @param needsQuery 은행 하나를 놓고 이 관계인지 물으려면 조회가 드는가.
 */
enum class Relation(val needsQuery: Boolean) {
    PUBLIC(needsQuery = false),
    ISSUER(needsQuery = false),
    MEMBER(needsQuery = true),
    INVITED(needsQuery = true),
    HOLDS_BALANCE(needsQuery = true),
}

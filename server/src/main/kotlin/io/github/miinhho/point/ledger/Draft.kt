package io.github.miinhho.point.ledger

/**
 * 아직 적히지 않은 사건. **원장의 규칙이 전부 여기 있다** — 복식이고, 0 원 전기가 없고,
 * 한 계정을 두 번 건드리지 않고, 건드릴 순서가 정해져 있다.
 *
 * 무엇으로 적히는지는 모른다. 표도 락도 트랜잭션도 여기서 보이지 않으므로 이 파일에는
 * import 가 없고, [DisciplineTest] 가 그것을 강제한다. 규칙을 바꾸려면 여기만 열면 되고,
 * 스프링 없이 돌려 볼 수 있다.
 */
class Draft private constructor(val kind: JournalKind, val lines: List<Line>) {
    /** 한 계정에 더해지는 양. 부호 하나로 적는다 — 차변·대변 칸을 나누지 않는다. */
    class Line(val holderKey: Long, val amount: Long)

    init {
        require(lines.isNotEmpty() == kind.posts) { "$kind 의 전기 유무가 종류와 맞지 않는다" }
        require(lines.none { it.amount == 0L }) { "0 원 전기는 참여하지 않은 계정을 참여한 것처럼 보이게 한다" }
        require(lines.map { it.holderKey }.toSet().size == lines.size) { "한 사건이 같은 계정을 두 번 건드린다" }
        require(lines.sumOf { it.amount } == 0L) { "복식이다 — 어디선가 나와 어디론가 간다" }
    }

    /**
     * 건드릴 순서. **오름차순 하나로 규칙 둘이 합쳐진다** — 발행 계정은 `holderKey` 가 0 이라
     * 언제나 맨 앞이고(공급의 뮤텍스를 먼저 쥔다), 보유자끼리는 id 순이라 A→B 와 B→A 가
     * 겹쳐도 서로를 기다리지 않는다.
     */
    val ordered: List<Line> get() = lines.sortedBy { it.holderKey }

    companion object {
        /** 발행 계정의 자리. `accounts.holder_key` 가 보유자 없음을 0 으로 접어 둔다. */
        const val ISSUANCE: Long = 0

        /** 발행 — 은행이 빚을 지고 발행자가 그만큼 갖는다. */
        fun issue(issuerKey: Long, amount: Long): Draft {
            require(issuerKey != ISSUANCE) { "발행 계정은 보유자가 될 수 없다" }
            return Draft(JournalKind.ISSUE, listOf(Line(ISSUANCE, -amount), Line(issuerKey, amount)))
        }

        /** 이체 — 빚의 임자가 바뀐다. 은행이 진 총액은 그대로다. */
        fun transfer(fromKey: Long, toKey: Long, amount: Long): Draft {
            require(fromKey != ISSUANCE && toKey != ISSUANCE) { "이체는 보유자끼리다" }
            return Draft(JournalKind.TRANSFER, listOf(Line(fromKey, -amount), Line(toKey, amount)))
        }

        /** 상한 변경 — 잔액은 안 움직인다. 약속이 바뀐 것도 사건이다. */
        fun capChange(): Draft = Draft(JournalKind.CAP_CHANGE, emptyList())
    }
}

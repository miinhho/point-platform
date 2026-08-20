# Engineering Workflow

All engineering tasks follow this workflow.

## Roles

* **Orchestrator** — plans, assesses risk, routes work, and owns completion.

* **Backend** — implements backend changes.

* **Frontend** — implements frontend changes.

* **QA** — independently verifies behavior using browser, accessibility, usability, performance, and regression testing as relevant. Follows `docs/QA.md`.

* **Review** — continuously checks **risk first, then logic**: what could go irreversibly wrong, whether the model matches the concept, and whether the code matches the contract. Code quality is in scope but reported last, except where a structure is a defect generator. Follows `docs/REVIEW.md`. Reports; does not fix.

**Self-review does not count as review.** Filling an empty field looks reasonable while
writing it and only reads wrong later — the author is the one person who cannot see it.
Every model-level defect so far (`Transfer.kind`, a fallback naming an unknown recipient
"me", a past event reading today's supply, the client counting name collisions inside its
own list) survived self-review and was found by the user.

**Review does not write code.** Five sessions share one worktree, so two writers in the
same directory overwrite each other — and a reviewer who fixes loses the independence that
is the entire point. Review sends findings **straight to the owning session**, not through
the Orchestrator; only contract changes come to the Orchestrator.

---

## Workflow

```text id="jyxtur"

Request

  ↓

Orchestrator

  ├─ Define acceptance criteria

  ├─ Identify affected areas

  ├─ Assess risk

  └─ Define verification

  ↓

Implementation

  ├─ Backend if affected

  └─ Frontend if affected

  ↓

Author check

  ↓

Cross-review if FE/BE boundary changed

  ↓

Relevant QA if needed

  ↓

HIGH risk → Review deep pass

  ↓

Final gate (Orchestrator)


Review ─── runs continuously, outside this flow ───→ findings to owning session

```

Use the minimum workflow necessary for the identified risk.

Do not invoke agents or verification steps that do not add meaningful confidence.

**Review is not a gate except at HIGH risk.** It runs continuously and its findings arrive
asynchronously as new work. Making it a per-task gate would turn the one session that never
stops looking into the one thing everybody waits on.

**Author check is not review.** It is the author reading their own diff before handing off —
useful, and not independent. Where this document previously said "self-review", read
"author check".

---

## 커밋 메시지

`type(scope): 한 줄` — Conventional Commits. **제목만 형식이고 본문은 지금 그대로다.**

```
fix(server): 초대는 소진된다 — 내보낸 사람이 옛 초대로 돌아왔다

removeMember 가 memberships 만 지우고 초대 행을 남겨서 ...
```

| type | 언제 |
|---|---|
| `feat` | 사용자가 할 수 있는 일이 늘었다 |
| `fix` | 하던 것이 틀렸다 |
| `refactor` | 동작이 그대로다 |
| `test` | 테스트만 |
| `docs` | 문서만 |
| `chore` | 빌드·설정·도구 |

scope 는 **자리 이름**이다 — `web` · `server` · `contract`(`docs/API.md`) · `field` ·
`workflow` · `ledger`.

**`!` 는 계약이 바뀔 때만 붙인다.** `feat(contract)!:` 처럼. 이 저장소에서 「깨진다」는
뜻은 하나다 — **프론트와 백엔드가 둘 다 따라와야 한다.** 이력에서 그것만 찾을 수 있으면
된다.

**본문에 무엇이 잘못됐고 왜 그렇게 고쳤는지를 적는다.** 문서에서 근거 서사를 걷어낸
자리가 여기다. 제목은 검색용이고 본문이 기록이다.

PR 제목도 같은 형식이다.

## 세션마다 워크트리, 변경마다 PR

**커밋에 남의 파일이 섞이는 것은 워크트리를 공유해서다.** `git add` 가 다른 세션의 진행
중 변경을 집는다. 자리를 나눠도 파일이 한 디렉터리에 있으면 막을 수 없다.

| 세션 | 워크트리 | 브랜치 |
|---|---|---|
| 프론트 | `../point-web` | `web/<슬라이스>` |
| 백엔드 | `../point-server` | `server/<슬라이스>` |
| 실기기 | `../point-qa` | `qa/<라운드>` |
| 조율 | 현재 워크트리 | `main` 직접 |
| 리뷰 | 없음 | PR 을 읽는다 |

**조율만 `main` 에 직접 커밋한다.** `docs/` 는 남이 그것을 읽어야 움직이는 것이라
리뷰 뒤에 두면 서로 기다린다. 대신 계약이 틀렸다고 보이면 리뷰가 언제든 올린다.

**커밋한 즉시 민다.** 로컬 `main` 만 앞서 있으면 거기서 딴 브랜치의 PR 이 낡은 base 와
비교돼 **남의 파일이 diff 에 섞여 보인다.** 워크트리로 막은 섞임이 PR 층에서 다시 난다.

### 격리는 셋을 다 해야 한다

워크트리는 파일만 가른다. **DB 와 포트는 여전히 공유물이다.**

| 무엇 | 공유하면 | 어떻게 |
|---|---|---|
| 파일 | 커밋에 섞인다 | 워크트리를 나눈다 |
| 스키마 | 판을 지우면 남의 서버가 죽는다 | 브랜치용 DB 를 따로 (`point_ledger` 등) |
| 포트 | 남이 보던 것이 바뀐다 | 서버 8081 · 화면 5174 처럼 비켜 쓴다. `main` 것이 8080 · 5173 |

**워크트리는 남의 파일만 막는다. 자기 것끼리는 안 막는다.** PR 이 리뷰 대기인 동안
같은 워크트리에서 다음 브랜치를 시작하면, 앞 PR 이 뒤 PR 의 파일을 삼킬 수 있다 —
리뷰를 안 거친 것이 `main` 에 들어간다. **PR 이 열려 있으면 다음 것은 워크트리를 하나
더 만든다.** `git worktree add` 는 싸다.

**커밋할 때 경로를 못박는다 — `git commit <경로>`.** `git add X && git commit` 은 X 를
스테이지에 **더할** 뿐이고, 커밋은 스테이지 전체를 담는다. 앞선 rebase 나 다른 작업이
남긴 것이 있으면 함께 간다. 한 체크아웃을 여러 손이 지나가는 곳에서는 그것이 남의 파일이다.

**PR 을 올린 뒤 `gh pr diff --name-only` 로 파일 목록을 본다.** 그 슬라이스의 것만
있어야 한다. 위 규칙을 지켜도 실수는 나고, 이것은 한 줄이며 섞임을 머지 전에 잡는
마지막 자리다.

### PR

**PR 은 크다. 슬라이스 하나, Phase 하나가 PR 하나다.** 잘게 쪼개지 않는다 —
**되돌릴 수 있는 단위가 그것**이어서다. Phase 2 가 반만 머지된 상태는 의미 있는 중간이
아니라 깨진 상태다.

리뷰가 답할 질문이 「모델이 개념과 어긋나는가」인 것도 이유다. **그것은 작은 diff 로 답할
수 없다.** 쪼개면 각각은 맞는데 합쳐서 틀린 것을 통과시키게 된다.

**커밋은 여전히 잘다**(F4). PR 이 크다는 것과 커밋이 크다는 것은 다르다.

큰 PR 의 실패 모드는 하나다 — **리뷰가 지쳐서 통과시킨다.** 그래서 리뷰는 diff 를 처음부터
읽지 않는다. **완료 기준에 적힌 테스트가 있는지부터 본다.** 없으면 그것만으로 지적이고,
diff 크기와 무관하게 거기서 돌려보낸다.

**크게 시작하되 보는 중에 자라지 않는다.** 리뷰나 실기기가 한 번 본 뒤로는 그 지적을
닫는 커밋만 얹는다. 새로 찾은 것은 다음 PR 이다 — 자라면 둘이 같은 PR 을 세 번 네 번
다시 보게 되고, 볼 때마다 앞서 본 것이 낡는다. 「PR 은 크다」는 **한 번에 보라**는 뜻이지
**보는 동안 커지라**는 뜻이 아니다.

본문에 **머지 뒤에 해야 할 일**을 적는다(스키마 재생성 같은 것).

| 무엇이 바뀌나 | 누가 보나 |
|---|---|
| `server/` | 리뷰 |
| `web/` | 리뷰 + 실기기 |
| 돈이 지나는 코어 | 리뷰. **승인 전에 머지하지 않는다** |

**리뷰는 여전히 고치지 않는다** — PR 코멘트로 남긴다. `gh pr diff` 로 보고, 필요하면
그 워크트리를 직접 읽는다.

**실기기는 그 브랜치를 자기 워크트리에 받아 비켜 쓴 포트로 띄워 본다.** 화면 변경은
diff 를 읽어서 알 수 없다 — `docs/QA.md` 가 재는 것들은 띄워야 나온다.

**머지는 구현 세션이 한다.** 조율은 머지하지 않는다.

---

## Risk

### LOW

Isolated, well-understood changes with limited impact and easy recovery.

Examples:

* styling/copy

* isolated UI changes

* straightforward bug fixes

* behavior-preserving refactors

Typical flow:

```text id="w8qqgi"

Implement → Author check → Relevant checks → Done

```

### MEDIUM

Changes with meaningful behavioral, contract, or regression risk.

Examples:

* API changes

* validation changes

* new user flows

* state-management changes

* schema changes

* cross-component behavior

Typical flow:

```text id="7l8fp8"

Implement → Author check → Cross-review if needed → QA → Done

```

### HIGH

Changes with significant security, data, operational, or user impact.

Examples:

* auth/authz

* payments

* sensitive data

* destructive operations

* risky migrations

* data integrity

* concurrency/idempotency

* critical infrastructure or flows

Typical flow:

```text id="ryv96a"

Implement

→ Author check

→ Cross-review if needed

→ Relevant QA

→ Review deep pass

→ Orchestrator final gate

→ Done

```

Risk determines **verification depth**, not which agents must participate.

---

## Implementation

Implementation agents must:

1. Understand the acceptance criteria and existing behavior.

2. Implement only the assigned scope.

3. Run relevant tests, type checks, and lint checks.

4. Read the resulting diff. This is an author check, not review.

5. Report unresolved concerns.

Passing tests alone does not imply completion. Neither does an author check.

---

## Cross-Review

Cross-review is required when Frontend and Backend share a **changed contract or assumption**.

It is not a general second code review. It is also not a substitute for **Review** —
cross-review is bounded to one change, Review runs continuously and owns the question
"does the contract still describe what the code does".

**Frontend reviewing Backend:**

* API contracts

* response/error behavior

* auth behavior

* null/optional states

* frontend-visible failure behavior

**Backend reviewing Frontend:**

* API usage

* validation/auth assumptions

* retries and duplicate requests

* state transitions

* concurrency/idempotency assumptions

* unintended backend side effects

If the FE/BE boundary did not meaningfully change, skip cross-review.

---

## QA

QA provides independent behavioral verification when it adds meaningful confidence.

Select only relevant checks:

| Change                         | Verification       |

| ------------------------------ | ------------------ |

| User-visible behavior          | Functional/browser |

| UI structure or interaction    | Accessibility      |

| New/changed user flow          | Usability          |

| Performance-sensitive behavior | Performance        |

| Meaningful regression risk     | Regression         |

QA is not mandatory for every LOW-risk task.

For bug fixes, reproduce the original failure when practical.

---

## HIGH-Risk Review

For HIGH-risk changes, **Review** performs the focused pass and the Orchestrator owns the
final gate. The Orchestrator does not repeat the pass — it decides whether the evidence is
enough to complete.

Review the risk-bearing parts of the change, especially:

* security/auth boundaries

* data integrity

* migration/destructive behavior

* concurrency/idempotency

* failure and recovery behavior

* unresolved review/QA findings

Do not repeat a general code review.

---

## 보고는 무엇을 보고 말하는지 적는다

다섯이 같은 워크트리에서 동시에 고친다. **읽는 동안 대상이 움직인다.**

리뷰·QA·실기기의 보고는 머리에 한 줄을 둔다.

```
> 본 것: <sha> · <연 자리>
```

이 한 줄이 둘을 막는다.

**낡은 것을 보고 말하는 것.** sha 가 있으면 저자가 「그건 그 뒤에 고쳤다」를 바로 답한다.
지금은 서로 추측하고, 보류를 걸었다 거두는 데 한 왕복이 든다.

**본 것보다 넓게 말하는 것.** 연 자리를 적으면 쓰는 사람이 스스로 걸린다 — 「초대
컨트롤러를 열었다」고 적어 놓고 「이 저장소에서 아무도 못 돌렸다」라고 쓸 수 없다.
넓혀 말하려면 넓힌 자리를 열어야 한다. 화면에서 본 것으로 서버가 무엇을 하는지 말하는
것도 같다.

**조율은 전파 전에 근거를 연다.** 남의 판정을 옮기는 것이 다른 세션의 **작업 순서를 바꾸는
것**이면 그 근거를 직접 본다. 판정을 다시 하는 것이 아니라 범위만 확인하는 것이고 대개
한 줄이다.

---

## Findings and Rework

Findings are either:

* **BLOCKING** — must be resolved before completion.

* **NON_BLOCKING** — may be recorded separately.

Findings come from QA, cross-review, or Review. **Review sends them straight to the owning
session**; the Orchestrator is involved only when the contract itself is wrong.

**보고에 「본 것」 줄이 없으면 되돌린다.** 앞 절의 한 줄이다 — 시점과 범위가 없는 지적은
받는 쪽이 그 둘을 추측해야 하고, 추측이 틀리면 고칠 필요 없는 것을 고치거나 남의 작업
순서가 바뀐다.

Blocking findings return to the owning agent:

```text id="ngqt5s"

Finding

→ Fix

→ Self-review

→ Re-run affected verification

```

Only repeat verification invalidated by the fix.

If implementation reveals new risk, unexpected scope, or a changed system boundary, stop expanding scope and return to the Orchestrator for replanning.

---

## Completion

The Orchestrator marks the task complete when:

* acceptance criteria are satisfied

* implementation and the author check are complete

* required checks pass

* required cross-review is complete

* required QA is complete

* blocking findings are resolved

* the HIGH-risk Review pass is complete when applicable

Completion requires evidence, not agent confidence.

---

## Decision Rules

```text id="k73sxy"

Backend affected?

→ Backend

Frontend affected?

→ Frontend

FE/BE contract or shared assumption changed?

→ Cross-review

Behavior needs independent verification?

→ Relevant QA

HIGH risk?

→ Review deep pass, then Orchestrator final gate

Model, contract, or irreversible-path concern at any risk level?

→ Review (continuous — no need to route it)

```

&gt; **Risk determines verification depth.

&gt; Affected behavior determines verification type.

&gt; Changed boundaries determine cross-review.**


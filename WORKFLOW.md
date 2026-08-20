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

## 코어 로직은 워크트리에서 만들고 PR 로 낸다

원장 전환처럼 **돈이 지나는 코어**를 고칠 때만이다. 화면 작업과 일상 수정은 그대로 간다.

**격리는 셋을 다 해야 한다.** 워크트리는 파일만 가른다 — DB 와 포트는 여전히 공유물이다.

| 무엇 | 공유하면 | 어떻게 |
|---|---|---|
| 파일 | 서로 덮는다 | `git worktree add ../point-ledger ledger` |
| 스키마 | 판을 지우면 남의 서버가 죽는다 | 같은 MySQL 에 `point_ledger` DB 를 따로 |
| 포트 | QA 의 실서버가 바뀐다 | 8081 로 띄운다. 8080 은 `main` 것 |

### PR

**Phase 하나가 PR 하나다.** `main` 으로 낸다 — 오래 사는 브랜치를 만들지 않는다.
Phase 0~5 는 밖에서 보이는 계약을 바꾸지 않으므로 나눠 머지해도 프론트가 흔들리지 않는다.

PR 본문에 **머지 뒤에 해야 할 일**을 적는다. 스키마가 바뀌는 Phase 는 `main` 을 쓰는
쪽이 DB 를 다시 만들어야 하고, 그것을 적지 않으면 다음 사람이 부팅 실패로 만난다.

### 리뷰

**리뷰 세션이 그 PR 을 본다.** 코어 로직은 HIGH 위험이므로(데이터 정합성 · 동시성 ·
되돌릴 수 없는 돈) **리뷰 승인 전에 머지하지 않는다.**

리뷰는 여전히 고치지 않는다 — PR 코멘트로 남긴다. `gh pr diff` 로 보고, 필요하면
워크트리를 직접 읽는다. 계약을 바꿔야 하는 것만 조율에 올린다.

승인이 나면 **구현 세션이 머지한다.** 조율은 머지하지 않는다.

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

## Findings and Rework

Findings are either:

* **BLOCKING** — must be resolved before completion.

* **NON_BLOCKING** — may be recorded separately.

Findings come from QA, cross-review, or Review. **Review sends them straight to the owning
session**; the Orchestrator is involved only when the contract itself is wrong.

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


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

### 격리는 셋을 다 해야 한다

워크트리는 파일만 가른다. **DB 와 포트는 여전히 공유물이다.**

| 무엇 | 공유하면 | 어떻게 |
|---|---|---|
| 파일 | 커밋에 섞인다 | 워크트리를 나눈다 |
| 스키마 | 판을 지우면 남의 서버가 죽는다 | 브랜치용 DB 를 따로 (`point_ledger` 등) |
| 포트 | 남이 보던 것이 바뀐다 | 서버 8081 · 화면 5174 처럼 비켜 쓴다. `main` 것이 8080 · 5173 |

### PR

**PR 은 슬라이스 단위다.** 커밋마다가 아니다 — 사용자가 끝까지 할 수 있는 일 하나가
PR 하나다. 본문에 **머지 뒤에 해야 할 일**을 적는다(스키마 재생성 같은 것).

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

